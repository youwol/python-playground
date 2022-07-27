import {
    InstallMessageEvent,
    Project,
    RawLog,
    Requirements,
    RunConfiguration,
} from '../models'
import { BehaviorSubject, combineLatest, Observable, ReplaySubject } from 'rxjs'
import { debounceTime, filter, map, scan, skip, take } from 'rxjs/operators'
import { Explorer } from '..'
import { createProjectRootNode } from '../explorer'
import { Common } from '@youwol/fv-code-mirror-editors'
import {
    install,
    SourceLoadedEvent,
    SourceParsedEvent,
    StartEvent,
} from '@youwol/cdn-client'
import {
    formatInstallMessages,
    patchPythonSrc,
    registerYouwolUtilsModule,
} from './utils'

declare type CodeEditorModule = typeof import('@youwol/fv-code-mirror-editors')

/**
 * @category State
 */
export class ProjectState {
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
    public readonly installMessage$ = new ReplaySubject<InstallMessageEvent>()

    /**
     * @group Observables
     */
    public readonly accInstallMessages$: Observable<InstallMessageEvent[]>

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
     * This module is fetched in due time, see [[CodeEditorView]].
     *
     * @group ES Modules
     */
    public readonly CodeEditorModule: CodeEditorModule

    /**
     * @group Observables
     */
    public readonly project$: Observable<Project>

    constructor({
        project,
        CodeEditor,
    }: {
        project: Project
        CodeEditor: CodeEditorModule
    }) {
        this.rawLog$.next({
            level: 'info',
            message: 'Welcome to the python playground 🐍',
        })

        this.CodeEditorModule = CodeEditor
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

        this.ideState = new CodeEditor.Common.IdeState({
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

        this.accInstallMessages$ = this.installMessage$.pipe(
            scan((acc, e) => [...acc, e], []),
        )
        const pyodide = window['loadedPyodide']

        const systemVersion = pyodide.runPython('import sys\nsys.version')
        this.rawLog$.next({
            level: 'info',
            message: `Python ${systemVersion.split('\n')[0]}`,
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
                        .filter(
                            ([path]) =>
                                !['/requirements', '/configurations'].includes(
                                    path,
                                ),
                        )
                        .map(([name, content]) => {
                            return {
                                path: `.${name}`,
                                content,
                            }
                        }),
                }
            }),
        )
    }

    selectConfiguration(name: string) {
        this.selectedConfiguration$.next(name)
    }

    applyConfigurations() {
        combineLatest([this.selectedConfiguration$, this.ideState.fsMap$])
            .pipe(take(1))
            .subscribe(([configurationName, fileSystem]) => {
                const configurations = JSON.parse(
                    fileSystem.get('/configurations'),
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
            const requirements = JSON.parse(fileSystem.get('/requirements'))
            this.installRequirements(requirements)
            this.requirements$.next(requirements)
        })
    }

    runCurrentConfiguration() {
        const pyodide = window['loadedPyodide']
        pyodide.registerJsModule('cdn_client', window['@youwol/cdn-client'])
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
                registerYouwolUtilsModule(pyodide, fileSystem, this)
                fileSystem.forEach((value, key) => {
                    const path = key.substring(1)
                    pyodide.FS.writeFile(path, value, { encoding: 'utf8' })
                })
                const content = fileSystem.get(sourcePath.substring(1))
                const patchedContent = patchPythonSrc(content)
                pyodide.runPythonAsync(patchedContent)
            })
    }

    private installRequirements(requirements: Requirements) {
        const pyodide = window['loadedPyodide']
        const messageCallback = (rawMessage: string) => {
            this.rawLog$.next({ level: 'info', message: rawMessage })
            const installMessages = formatInstallMessages(this.id, rawMessage)
            installMessages.forEach((message) => {
                this.installMessage$.next(message)
            })
        }

        const pyPackages = requirements.pythonPackages.map((name) => {
            return pyodide.loadPackage(name, messageCallback).then(() => {
                this.installMessage$.next({
                    projectId: this.id,
                    packageName: name,
                    step: 'installing',
                })
                pyodide.runPython(`import ${name}`)
                this.installMessage$.next({
                    projectId: this.id,
                    packageName: name,
                    step: 'installed',
                })
                return true
            })
        })
        const jsPackages = install({
            ...requirements.javascriptPackages,
            onEvent: (cdnEvent) => {
                const emitInstallMessage = (step, ev) => {
                    this.installMessage$.next({
                        projectId: this.id,
                        packageName: ev.targetName,
                        step,
                    })
                    this.rawLog$.next({
                        level: 'info',
                        message: `${step} js module '${ev.targetName}'`,
                    })
                }
                if (cdnEvent instanceof StartEvent) {
                    emitInstallMessage('loading', cdnEvent)
                }

                if (cdnEvent instanceof SourceLoadedEvent) {
                    emitInstallMessage('loaded', cdnEvent)
                }
                if (cdnEvent instanceof SourceParsedEvent) {
                    emitInstallMessage('installed', cdnEvent)
                }
            },
        })

        Promise.all([...pyPackages, jsPackages])
            .then(() => {
                Object.entries(requirements.javascriptPackages.aliases).forEach(
                    ([alias, originalName]) => {
                        this.rawLog$.next({
                            level: 'info',
                            message: `create alias '${alias}' to import '${originalName}' (version ${window[alias].__yw_set_from_version__}) `,
                        })
                        pyodide.registerJsModule(alias, window[alias])
                    },
                )
            })
            .then(() => {
                this.projectLoaded$.next(true)
            })
    }
}
