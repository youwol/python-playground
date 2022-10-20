import { Project, RawLog, Requirements, RunConfiguration } from '../models'
import {
    BehaviorSubject,
    combineLatest,
    from,
    merge,
    Observable,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { filter, map, mergeMap, scan, skip, take } from 'rxjs/operators'
import { OutputViewNode } from '../explorer'
import { Common } from '@youwol/fv-code-mirror-editors'
import { CdnEvent } from '@youwol/cdn-client'
import {
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
} from './utils'
import { installRequirements } from '../load-project'

/**
 * @category Data Structure
 */
export class Environment {
    static ExportedPyodideInstanceName = 'loadedPyodide'

    /**
     * @group Immutable Constants
     */
    public readonly pyodide
    /**
     * @group Immutable Constants
     */
    public readonly pythonVersion: string
    /**
     * @group Immutable Constants
     */
    public readonly pyodideVersion: string
    /**
     * @group Immutable Constants
     */
    public readonly nativePythonGlobals: string[]

    constructor(params: { pyodide }) {
        Object.assign(this, params)
        this.pythonVersion = this.pyodide.runPython('import sys\nsys.version')
        this.pyodideVersion =
            window[Environment.ExportedPyodideInstanceName].version
        this.nativePythonGlobals = [
            ...this.pyodide
                .runPython(
                    'import sys\nfrom pyodide.ffi import to_js\nto_js(sys.modules)',
                )
                .keys(),
        ]
    }
}

/**
 * @category State
 */
export class ProjectState {
    /**
     * @group Observables
     */
    public readonly environment$ = new ReplaySubject<Environment>(1)

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
     * @group Observables
     */
    public readonly project$: Observable<Project>

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

        this.environment$.subscribe((env) => {
            this.rawLog$.next({
                level: 'info',
                message: `Python ${env.pythonVersion.split('\n')[0]}`,
            })
            this.rawLog$.next({
                level: 'info',
                message: `Pyodide ${env.pyodideVersion}`,
            })
        })

        this.installRequirements(project.environment.requirements)
        this.project$ = combineLatest([
            this.requirements$,
            this.configurations$,
            this.ideState.fsMap$.pipe(filter((fsMap) => fsMap != undefined)),
        ]).pipe(
            skip(1),
            map(([requirements, configurations, fsMap]) => {
                return {
                    id: project.id,
                    name: project.name,
                    environment: {
                        requirements,
                        configurations,
                    },
                    sources: Array.from(fsMap.entries()).map(
                        ([name, content]) => {
                            return {
                                path: name,
                                content,
                            }
                        },
                    ),
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
        this.ideState.fsMap$.pipe(take(1)).subscribe((fileSystem) => {
            const requirements = JSON.parse(fileSystem.get('./requirements'))
            this.installRequirements(requirements)
            this.requirements$.next(requirements)
        })
    }

    runCurrentConfiguration() {
        this.runStart$.next(true)
        combineLatest([
            this.environment$,
            this.configurations$,
            this.selectedConfiguration$,
            this.ideState.fsMap$,
        ])
            .pipe(
                take(1),
                mergeMap((params) => this.initializeBeforeRun(params)),
            )
            .subscribe(
                ({
                    environment,
                    fileSystem,
                    configurations,
                    selectedConfigName,
                }) => {
                    const selectedConfig = configurations.find(
                        (config) => config.name == selectedConfigName,
                    )
                    const sourcePath = selectedConfig.scriptPath
                    const patchedContent = patchPythonSrc(
                        sourcePath,
                        fileSystem.get(sourcePath),
                    )
                    return environment.pyodide
                        .runPythonAsync(patchedContent)
                        .then(() => {
                            this.runDone$.next(true)
                        })
                },
            )
    }

    private initializeBeforeRun([
        environment,
        configurations,
        selectedConfigName,
        fileSystem,
    ]) {
        const outputs = {
            onLog: (log) => this.rawLog$.next(log),
            onView: (view) => {
                const newNode = new OutputViewNode({
                    ...view,
                    projectState: this,
                })
                this.createdOutput$.next(newNode)
            },
        }
        return from(
            Promise.all([
                registerYwPyodideModule(environment, fileSystem, outputs),
                registerJsModules(environment, fileSystem),
                syncFileSystem(environment, fileSystem),
            ]),
        ).pipe(
            map(() => {
                return {
                    environment,
                    configurations,
                    selectedConfigName,
                    fileSystem,
                }
            }),
        )
    }

    private installRequirements(requirements: Requirements) {
        installRequirements({
            requirements,
            cdnEvent$: this.cdnEvent$,
            rawLog$: this.rawLog$,
            environment$: this.environment$,
        }).then(() => {
            this.projectLoaded$.next(true)
        })
    }
}
