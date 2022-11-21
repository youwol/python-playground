import {
    BehaviorSubject,
    combineLatest,
    Observable,
    of,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { Common } from '@youwol/fv-code-mirror-editors'
import { RawLog, Requirements, RunConfiguration, WorkerCommon } from '../models'
import { CdnEvent } from '@youwol/cdn-client'
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
        requirements: Requirements,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Observable<CdnEvent>,
    ): Observable<unknown>
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
        const nativeFiles = [requirementsFile, configurationsFile]
        this.configurations$.next(initialModel.environment.configurations)
        this.requirements$.next(initialModel.environment.requirements)
        this.selectedConfiguration$.next(
            initialModel.environment.configurations[0].name,
        )

        this.ideState = new Common.IdeState({
            files: [
                requirementsFile,
                configurationsFile,
                ...initialModel.sources,
            ],
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

        this.serialized$ = combineLatest([
            signals && signals.save$ ? signals.save$ : of(true),
            this.requirements$,
            this.configurations$,
            this.ideState.fsMap$.pipe(filter((fsMap) => fsMap != undefined)),
        ]).pipe(
            map(([_, requirements, configurations, fsMap]) => {
                return {
                    id: initialModel.id,
                    name: initialModel.name,
                    environment: {
                        requirements,
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
            this.executingImplementation.signals.install$
                .pipe(mergeMap(() => this.applyRequirements()))
                .subscribe()
        }

        this.applyRequirements().subscribe()
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
        this.projectLoaded$.next(false)
        this.cdnEvent$.next('reset')
        return this.requirements$.pipe(
            take(1),
            mergeMap((requirements) => {
                return this.executingImplementation.installRequirements(
                    requirements,
                    this.rawLog$,
                    this.cdnEvent$,
                )
            }),
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
