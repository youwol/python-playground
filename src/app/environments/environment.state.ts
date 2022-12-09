import {
    BehaviorSubject,
    combineLatest,
    from,
    merge,
    Observable,
    of,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { Common } from '@youwol/fv-code-mirror-editors'
import { RawLog, Requirements, RunConfiguration, WorkerCommon } from '../models'
import {
    CdnEvent,
    queryLoadingGraph,
    InstallLoadingGraphInputs,
} from '@youwol/cdn-client'
import {
    filter,
    map,
    mergeMap,
    scan,
    shareReplay,
    skip,
    take,
    tap,
} from 'rxjs/operators'
import { patchPythonSrc, WorkerListener } from './in-worker-executable'
import { logFactory } from '../log-factory.conf'
import { setup } from '../../auto-generated'

const log = logFactory().getChildLogger('environment.state.ts')

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

export interface ExecutingImplementation {
    signals?: {
        install$?: Observable<unknown>
        save$?: Observable<unknown>
    }

    serialize?(model: WorkerCommon): WorkerCommon & { [k: string]: unknown }

    execPythonCode(
        code: string,
        fileSystem: Map<string, string>,
        rawLog$: Subject<RawLog>,
        pythonGlobals?: Record<string, unknown>,
        // this next argument should somehow disappear
        workerListener?: WorkerListener,
    ): Observable<unknown>

    installRequirements(
        lockFile: InstallLoadingGraphInputs,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Observable<CdnEvent>,
    ): Observable<unknown>
}

function fetchLoadingGraph(requirements) {
    return from(
        Promise.all([
            queryLoadingGraph({
                modules: [
                    ...requirements.javascriptPackages.modules,
                    `rxjs#${setup.runTimeDependencies.externals.rxjs}`,
                    '@youwol/cdn-pyodide-loader#^0.1.1',
                ],
            }),
            queryLoadingGraph({
                modules: requirements.pythonPackages.map(
                    (p) => `@pyodide/${p}`,
                ),
            }),
        ]),
    ).pipe(
        map(([loadingGraphJs, loadingGraphPy]) => {
            return {
                loadingGraph: loadingGraphJs,
                aliases: requirements.javascriptPackages.aliases,
                customInstallers: [
                    {
                        module: '@youwol/cdn-pyodide-loader#^0.1.2',
                        installInputs: {
                            loadingGraph: loadingGraphPy,
                            warmUp: true,
                            exportedPyodideInstanceName:
                                Environment.ExportedPyodideInstanceName,
                        },
                    },
                ],
            }
        }),
    )
}

/**
 * @category State
 */
export class EnvironmentState<T extends ExecutingImplementation> {
    /**
     * @group Immutable Constants
     */
    public readonly executingImplementation: T

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
     * This observable emit whenever applying new (raw) requirements is triggered.
     *
     * @group Observables
     */
    private readonly applyRequirements$ = new Subject()

    /**
     * @group Observables
     */
    public readonly lockFile$: Observable<InstallLoadingGraphInputs>

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
    public readonly cdnEvents$: Observable<CdnEvent[]>

    /**
     * @group Observables
     */
    public readonly projectLoaded$ = new BehaviorSubject(false)

    /**
     * @group Observables
     */
    public readonly rawLog$ = new Subject<RawLog>()

    /**
     * @group Observables
     */
    public readonly serialized$: Observable<WorkerCommon>

    /**
     * @group Observables
     */
    public readonly runStart$ = new Subject<true>()

    /**
     * @group Observables
     */
    public readonly runDone$ = new Subject<true>()

    constructor({
        initialModel,
        rawLog$,
        executingImplementation,
    }: {
        initialModel: WorkerCommon
        rawLog$: Subject<RawLog>
        executingImplementation: T
    }) {
        this.executingImplementation = executingImplementation
        const signals = this.executingImplementation.signals
        this.rawLog$.subscribe((log) => {
            rawLog$.next(log)
        })

        this.id = initialModel.id

        log.info(`Initialize state for ${initialModel.id}`, () => {
            return initialModel.environment.requirements
        })
        const requirementsFile = {
            path: './requirements',
            content: JSON.stringify(
                initialModel.environment.requirements,
                null,
                4,
            ),
            subject: this.requirements$,
        }
        const configurationsFile = {
            path: './configurations',
            content: JSON.stringify(
                initialModel.environment.configurations,
                null,
                4,
            ),
            subject: this.configurations$,
        }
        const locksFile = {
            path: './locks',
            content: JSON.stringify(
                initialModel.environment.lockFile || {},
                null,
                4,
            ),
            // The user can not edit this file
            subject: new Subject(),
        }
        const nativeFiles = [requirementsFile, configurationsFile, locksFile]
        this.configurations$.next(initialModel.environment.configurations)
        this.requirements$.next(initialModel.environment.requirements)
        this.selectedConfiguration$.next(
            initialModel.environment.configurations[0].name,
        )

        this.ideState = new Common.IdeState({
            files: [...nativeFiles, ...initialModel.sources],
            defaultFileSystem: Promise.resolve(new Map<string, string>()),
        })
        nativeFiles.map((nativeFile) => {
            return this.ideState.updates$[nativeFile.path]
                .pipe(skip(1))
                .subscribe(({ content }) => {
                    try {
                        nativeFile.subject.next(JSON.parse(content))
                    } catch (_) {
                        //no op: when modifying content it is not usually a valid JSON
                    }
                })
        })
        this.lockFile$ = merge(
            this.applyRequirements$.pipe(
                mergeMap(() => {
                    return fetchLoadingGraph(this.requirements$.value)
                }),
            ),
            initialModel.environment.lockFile
                ? of(initialModel.environment.lockFile)
                : this.requirements$.pipe(
                      take(1),
                      mergeMap((requirements) => {
                          return fetchLoadingGraph(requirements)
                      }),
                  ),
        ).pipe(shareReplay({ bufferSize: 1, refCount: true }))

        this.lockFile$.subscribe((lock) => {
            if (!this.ideState.fsMap$.value) {
                return
            }
            this.ideState.update({
                path: './locks',
                content: JSON.stringify(lock, null, 4),
                updateOrigin: { uid: 'environment.state' },
            })
        })
        this.lockFile$
            .pipe(mergeMap((lockFile) => this.installLockFile(lockFile)))
            .subscribe()

        this.serialized$ = combineLatest([
            signals && signals.save$ ? signals.save$ : of(true),
            this.lockFile$,
            this.configurations$,
            this.ideState.fsMap$.pipe(filter((fsMap) => fsMap != undefined)),
        ]).pipe(
            map(([_, lockFile, configurations, fsMap]) => {
                return {
                    id: initialModel.id,
                    name: initialModel.name,
                    environment: {
                        requirements: this.requirements$.value,
                        lockFile: lockFile,
                        configurations,
                    },
                    sources: Array.from(fsMap.entries())
                        .filter(([name]) => {
                            return name.endsWith('.py') || name.endsWith('.js')
                        })
                        .map(([name, content]) => {
                            return {
                                path: name,
                                content,
                            }
                        }),
                }
            }),
            map((model) => {
                return this.executingImplementation.serialize
                    ? this.executingImplementation.serialize(model)
                    : model
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
        )
        this.cdnEvents$ = this.cdnEvent$.pipe(
            scan((acc, e) => {
                if (e == 'reset') {
                    return []
                }
                return [...acc, e]
            }, []),
            shareReplay({ bufferSize: 1, refCount: true }),
        )
        if (signals && signals.install$) {
            // This is when the capacity of a workers pool is increased: to be improved
            this.executingImplementation.signals.install$
                .pipe(
                    mergeMap(() => this.lockFile$),
                    mergeMap((lockFile) => this.installLockFile(lockFile)),
                )
                .subscribe()
        }
    }

    removeFile(path: string) {
        this.ideState.removeFile(path)
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
        this.applyRequirements$.next()
    }

    installLockFile(lockFile: InstallLoadingGraphInputs) {
        this.projectLoaded$.next(false)
        this.cdnEvent$.next('reset')
        return this.executingImplementation
            .installRequirements(lockFile, this.rawLog$, this.cdnEvent$)
            .pipe(
                tap(() => {
                    this.projectLoaded$.next(true)
                }),
            )
    }

    run() {
        this.runStart$.next(true)
        combineLatest([
            this.configurations$,
            this.selectedConfiguration$,
            this.ideState.fsMap$,
        ])
            .pipe(
                take(1),
                map(([configurations, selectedConfigName, fsMap]) => {
                    const selectedConfig = configurations.find(
                        (config) => config.name == selectedConfigName,
                    )
                    return {
                        selectedConfig,
                        fileSystem: fsMap,
                    }
                }),
                mergeMap(({ fileSystem, selectedConfig }) => {
                    const sourcePath = selectedConfig.scriptPath
                    const patchedContent = patchPythonSrc(
                        fileSystem.get(sourcePath),
                    )
                    return this.executingImplementation.execPythonCode(
                        patchedContent,
                        fileSystem,
                        this.rawLog$,
                    )
                }),
            )
            .subscribe(() => {
                this.runDone$.next(true)
            })
    }
}
