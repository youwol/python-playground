import { Project, RawLog, Requirements, RunConfiguration } from '../models'
import {
    BehaviorSubject,
    combineLatest,
    merge,
    Observable,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { debounceTime, filter, map, scan, skip, take } from 'rxjs/operators'
import { Explorer } from '..'
import { createProjectRootNode, OutputViewNode, SourceNode } from '../explorer'
import { Common } from '@youwol/fv-code-mirror-editors'
import { install, CdnEvent } from '@youwol/cdn-client'
import { patchPythonSrc, registerYouwolUtilsModule } from './utils'

export interface DisplayedElement {
    title: string
    htmlElement: HTMLElement
}


/**
 * @category State
 */
export class ProjectState {
    pyodide
    /**
     * @group Immutable Constants
     */
    public readonly id: string

    /**
     * @group States
     */
    public readonly ideState: Common.IdeState

    /**
     * @group Observables
     */
    public readonly requirements$ = new BehaviorSubject<Requirements>({
        pythonPackages: [],
        javascriptPackages: { modules: [], aliases: {} },
    })

    /**
     * @group Observables
     */
    public readonly configurations$ = new BehaviorSubject<RunConfiguration[]>(
        [],
    )

    /**
     * @group Observables
     */
    public readonly selectedConfiguration$ = new BehaviorSubject<string>(
        undefined,
    )

    /**
     * @group Observables
     */
    public readonly cdnEvent$ = new ReplaySubject<CdnEvent>()

    /**
     * @group Observables
     */
    public readonly projectLoaded$ = new BehaviorSubject(false)

    /**
     * @group Observables
     */
    public readonly rawLog$ = new ReplaySubject<RawLog>()

    /**
     * @group States
     */
    public readonly explorerState: Explorer.TreeState

    /**
     * @group Observables
     */
    public readonly project$: Observable<Project>

    /**
     * @group Observables
     */
    public readonly displayElement$ = new ReplaySubject<DisplayedElement>(1)

    /**
     * @group Observables
     */
    public readonly createdOutput$ = new ReplaySubject<OutputViewNode>(1)

    /**
     * @group Observables
     */
    public readonly createdOutputs$ = new BehaviorSubject<OutputViewNode[]>([])

    /**
     * @group Observables
     */
    public readonly runStart$ = new Subject<true>()

    /**
     * @group Observables
     */
    public readonly runDone$ = new Subject<true>()

    /**
     *
     * @group Observables
     */
    public readonly openedPyFiles$ = new BehaviorSubject<string[]>([])

    constructor({ project }: { project: Project }) {
        this.rawLog$.next({
            level: 'info',
            message: 'Welcome to the python playground 🐍',
        })

        this.id = project.id

        const requirementsFile = {
            path: './requirements',
            content: JSON.stringify(project.environment.requirements, null, 4),
        }
        const configurationsFile = {
            path: './configurations',
            content: JSON.stringify(
                project.environment.configurations,
                null,
                4,
            ),
        }
        this.configurations$.next(project.environment.configurations)
        this.requirements$.next(project.environment.requirements)
        this.selectedConfiguration$.next(
            project.environment.configurations[0].name,
        )

        this.ideState = new Common.IdeState({
            files: [requirementsFile, configurationsFile, ...project.sources],
            defaultFileSystem: Promise.resolve(new Map<string, string>()),
        })
        const projectNode = createProjectRootNode(project, this)
        this.explorerState = new Explorer.TreeState({
            rootNode: projectNode,
        })

        this.projectLoaded$.subscribe((loaded) => {
            loaded
                ? projectNode.removeProcess(project.id)
                : projectNode.addProcess({ type: 'loading', id: project.id })
        })

        this.installRequirements(project.environment.requirements)
        this.project$ = combineLatest([
            this.requirements$,
            this.configurations$,
            this.ideState.fsMap$.pipe(filter((fsMap) => fsMap != undefined)),
        ]).pipe(
            skip(1),
            debounceTime(1000),
            map(([requirements, configurations, fsMap]) => {
                return {
                    id: project.id,
                    name: project.name,
                    environment: {
                        requirements,
                        configurations,
                    },
                    sources: Array.from(fsMap.entries())
                        .map(([name, content]) => {
                            return {
                                path: name,
                                content,
                            }
                        }),
                }
            }),
        )

        merge(this.runStart$, this.createdOutput$)
            .pipe(
                scan(
                    (acc, e: true | OutputViewNode) =>
                        e === true ? [] : [...acc, e],
                    [],
                ),
            )
            .subscribe((outputs) => {
                this.createdOutputs$.next(outputs)
            })

        this.explorerState.selectedNode$.subscribe((node) => {
            if (node instanceof SourceNode) {
                this.openedPyFiles$.next([node.id])
            }
        })
    }

    selectConfiguration(name: string) {
        this.selectedConfiguration$.next(name)
    }

    applyConfigurations() {
        combineLatest([this.selectedConfiguration$, this.ideState.fsMap$])
            .pipe(take(1))
            .subscribe(([configurationName, fileSystem]) => {
                const configurations = JSON.parse(
                    fileSystem.get('./configurations'),
                )
                const selected = configurations.find(
                    (conf) => conf.name == configurationName,
                )
                    ? configurationName
                    : configurations[0].name
                this.configurations$.next(configurations)
                this.selectedConfiguration$.next(selected)
            })
    }

    applyRequirements() {
        this.projectLoaded$.next(false)
        const node = this.explorerState.getNode(this.id)
        this.explorerState.selectNodeAndExpand(node)
        this.ideState.fsMap$.pipe(take(1)).subscribe((fileSystem) => {
            const requirements = JSON.parse(fileSystem.get('./requirements'))
            this.installRequirements(requirements)
            this.requirements$.next(requirements)
        })
    }

    runCurrentConfiguration() {
        this.runStart$.next(true)
        this.pyodide.registerJsModule(
            'cdn_client',
            window['@youwol/cdn-client'],
        )
        combineLatest([
            this.configurations$,
            this.selectedConfiguration$,
            this.ideState.fsMap$,
        ])
            .pipe(take(1))
            .subscribe(([configurations, selectedConfigName, fileSystem]) => {
                const selectedConfig = configurations.find(
                    (config) => config.name == selectedConfigName,
                )
                const sourcePath = selectedConfig.scriptPath
                registerYouwolUtilsModule(this.pyodide, fileSystem, this)
                fileSystem.forEach((value, path) => {
                    path.endsWith('.py') &&
                        this.pyodide.FS.writeFile(path, value, {
                            encoding: 'utf8',
                        })
                })
                const content = fileSystem.get(sourcePath)
                const patchedContent = patchPythonSrc(sourcePath, content)
                this.pyodide.runPythonAsync(patchedContent).then(() => {
                    this.runDone$.next(true)
                })
            })
    }

    requestOutputViewCreation({ name, htmlElement }) {

        const newNode = new OutputViewNode({
            name,
            projectState: this,
            htmlElement,
        })
        this.createdOutput$.next(newNode)
    }

    private installRequirements(requirements: Requirements) {
        const exportedPyodideInstanceName = 'loadedPyodide'
        const dependencies = install({
            ...requirements.javascriptPackages,
            customInstallers: [
                {
                    module: '@youwol/cdn-pyodide-loader',
                    installInputs: {
                        modules: requirements.pythonPackages.map(
                            (p) => `@pyodide/${p}`,
                        ),
                        warmUp: true,
                        onEvent: (cdnEvent) => this.cdnEvent$.next(cdnEvent),
                        exportedPyodideInstanceName,
                    },
                },
            ],
            onEvent: (cdnEvent) => {
                this.cdnEvent$.next(cdnEvent)
            },
        }) as unknown as Promise<{ [exportedPyodideInstanceName] }>

        dependencies
            .then((window) => {
                this.pyodide = window[exportedPyodideInstanceName]
                const systemVersion = this.pyodide.runPython(
                    'import sys\nsys.version',
                )
                this.rawLog$.next({
                    level: 'info',
                    message: `Python ${systemVersion.split('\n')[0]}`,
                })
                Object.entries(requirements.javascriptPackages.aliases).forEach(
                    ([alias, originalName]) => {
                        this.rawLog$.next({
                            level: 'info',
                            message: `create alias '${alias}' to import '${originalName}' (version ${window[alias].__yw_set_from_version__}) `,
                        })
                        this.pyodide.registerJsModule(alias, window[alias])
                    },
                )
            })
            .then(() => {
                this.projectLoaded$.next(true)
            })
    }
}
