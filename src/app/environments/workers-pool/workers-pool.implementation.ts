import {
    Environment,
    EnvironmentState,
    ExecutingImplementation,
} from '../environment.state'
import { RawLog, Requirements, WorkerCommon } from '../../models'
import { BehaviorSubject, forkJoin, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, skip, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageDataExit,
    WorkersFactory,
} from './workers-factory'
import {
    dispatchWorkerMessage,
    formatCdnDependencies,
    objectPyToJs,
} from './utils'
import { Context } from '../../context'
import {
    cleanFileSystem,
    getModuleNameFromFile,
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
    WorkerListener,
} from '../in-worker-executable'
import { CdnEvent, getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'
import { setup } from '../../../auto-generated'

interface EntryPointSyncFsMapArgs {
    fsMap: Map<string, string>
    exportedPyodideInstanceName: string
    exportedRxjsSymbol: string
}

function entryPointSyncEnv(
    input: EntryPointArguments<EntryPointSyncFsMapArgs>,
) {
    const pyodide = self[input.args.exportedPyodideInstanceName]
    const registerYwPyodideModule = self['registerYwPyodideModule']

    const outputs = {
        onLog: (log) => {
            self['getPythonChannel$']().next({ type: 'PythonStdOut', log })
        },
        onView: (view) => {
            self['getPythonChannel$']().next({ type: 'PythonViewOut', view })
        },
        onData: (data) => {
            self['getPythonChannel$']().next({ type: 'WorkerData', data })
        },
    }

    pyodide.registerJsModule('python_playground', {
        worker_thread: {
            Emitter: {
                send: (d: unknown) => {
                    outputs.onData(d)
                },
            },
        },
    })

    return Promise.all([
        registerYwPyodideModule(pyodide, input.args.fsMap, outputs),
    ])
}

interface EntryPointExeArgs {
    content: string
    fileSystem: Map<string, string>
    exportedPyodideInstanceName: string
    pythonGlobals: Record<string, unknown>
}

async function entryPointExe(input: EntryPointArguments<EntryPointExeArgs>) {
    const pyodide = self[input.args.exportedPyodideInstanceName]
    const pythonChannel$ = new self['rxjs_APIv6'].ReplaySubject(1)
    self['getPythonChannel$'] = () => pythonChannel$
    const syncFileSystem = self['syncFileSystem']
    const cleanFileSystem = self['cleanFileSystem']
    await syncFileSystem(pyodide, input.args.fileSystem)
    // Need to unsubscribe following subscription at the end of the run
    pythonChannel$.subscribe((message) => {
        input.context.sendData(message)
    })
    const namespace = pyodide.toPy(input.args.pythonGlobals)
    await pyodide.runPythonAsync(input.args.content, {
        globals: namespace,
    })
    await cleanFileSystem(pyodide, input.args.fileSystem)
}

/**
 * @category State
 */
export class WorkersPoolImplementation implements ExecutingImplementation {
    /**
     * @group Observables
     */
    public readonly workersFactory$ = new BehaviorSubject<WorkersFactory>(
        undefined,
    )

    /**
     * @group Observables
     */
    public readonly busyWorkers$ = new BehaviorSubject<string[]>([])

    /**
     * @group Observable
     */
    public readonly capacity$: BehaviorSubject<number>

    /**
     * @group Observable
     */
    public readonly signals: {
        install$: Observable<number>
        save$: Observable<unknown>
    }

    constructor({ capacity }: { capacity: number }) {
        this.capacity$ = new BehaviorSubject<number>(capacity)
        this.signals = {
            install$: this.capacity$.pipe(skip(1)),
            save$: this.capacity$,
        }
    }

    serialize(model: WorkerCommon) {
        return {
            ...model,
            capacity: this.capacity$.value,
        }
    }

    installRequirements(
        requirements: Requirements,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Subject<CdnEvent>,
    ) {
        const minWorkersCount = this.capacity$.value
        const workersFactory = new WorkersFactory({
            cdnEvent$,
            cdnUrl: `${window.location.origin}${getUrlBase(
                '@youwol/cdn-client',
                cdnSetup.version,
            )}`,
            functions: {
                syncFileSystem: syncFileSystem,
                cleanFileSystem: cleanFileSystem,
                registerJsModules: registerJsModules,
                registerYwPyodideModule: registerYwPyodideModule,
                getModuleNameFromFile: getModuleNameFromFile,
            },
            cdnInstallation: formatCdnDependencies(requirements),
        })
        workersFactory.busyWorkers$.subscribe((workers) => {
            this.busyWorkers$.next(workers)
        })
        this.workersFactory$.value && this.workersFactory$.value.terminate()
        this.workersFactory$.next(undefined)
        return workersFactory
            .reserve({
                workersCount: minWorkersCount,
            })
            .pipe(
                tap(() => {
                    this.workersFactory$.next(workersFactory)
                }),
            )
    }

    initializeBeforeRun(fileSystem: Map<string, string>) {
        return this.workersFactory$.pipe(
            filter((pool) => pool != undefined),
            take(1),
            mergeMap((workersPool) => {
                const title = 'Synchronize file-system'
                const context = new Context(title)
                const installs$ = Object.keys(workersPool.workers$.value).map(
                    (workerId) => {
                        return workersPool
                            .schedule({
                                title,
                                entryPoint: entryPointSyncEnv,
                                args: {
                                    fsMap: fileSystem,
                                    exportedRxjsSymbol:
                                        setup.getDependencySymbolExported(
                                            'rxjs',
                                        ),
                                    exportedPyodideInstanceName:
                                        Environment.ExportedPyodideInstanceName,
                                },
                                targetWorkerId: workerId,
                                context,
                            })
                            .pipe(
                                filter((d) => d.type == 'Exit'),
                                take(1),
                            )
                    },
                )
                return forkJoin(installs$)
            }),
        )
    }

    execPythonCode(
        code: string,
        fileSystem: Map<string, string>,
        rawLog$: Subject<RawLog>,
        pythonGlobals: Record<string, unknown> = {},
        workerListener: WorkerListener = undefined,
    ): Observable<MessageDataExit> {
        return this.workersFactory$.pipe(
            filter((pool) => pool != undefined),
            take(1),
            mergeMap((workersPool) => {
                const title = 'Execute python'
                const context = new Context(title)
                return workersPool.schedule({
                    title,
                    entryPoint: entryPointExe,
                    args: {
                        content: code,
                        fileSystem: fileSystem,
                        exportedPyodideInstanceName:
                            Environment.ExportedPyodideInstanceName,
                        pythonGlobals,
                    },
                    context,
                })
            }),
            tap((message) => {
                dispatchWorkerMessage(message, rawLog$, workerListener)
            }),
            filter((d) => d.type == 'Exit'),
            map((result) => result.data as unknown as MessageDataExit),
            take(1),
        )
    }

    getPythonProxy(
        state: EnvironmentState<WorkersPoolImplementation>,
        rawLog$: Subject<RawLog>,
    ) {
        return new WorkerPoolPythonProxy({ state, rawLog$ })
    }
}

interface PythonProxyScheduleInput {
    title: string
    entryPoint: {
        file: string
        function: string
    }
    argument: unknown
}

export class WorkerPoolPythonProxy {
    /**
     * @group Immutable Constants
     */
    public readonly state: EnvironmentState<WorkersPoolImplementation>

    /**
     * @group Observables
     */
    public readonly rawLog$: Subject<RawLog>

    constructor(params: {
        state: EnvironmentState<WorkersPoolImplementation>
        rawLog$: Subject<RawLog>
    }) {
        Object.assign(this, params)
    }

    async schedule(
        input: PythonProxyScheduleInput,
        workerChannel: WorkerListener,
    ) {
        input = objectPyToJs(input)
        const filesystem = this.state.ideState.fsMap$.value
        const src = patchPythonSrc(`
from ${input.entryPoint.file} import ${input.entryPoint.function}       
result = ${input.entryPoint.function}(test_glob_var)
result
        `)
        return new Promise((resolve) => {
            this.state.executingImplementation
                .execPythonCode(
                    src,
                    filesystem,
                    this.rawLog$,
                    { test_glob_var: input.argument },
                    workerChannel,
                )
                .subscribe((messageResult: MessageDataExit) => {
                    resolve(messageResult.result)
                })
        })
    }

    reserve(workersCount) {
        return new Promise<void>((resolve) => {
            this.state.executingImplementation.workersFactory$
                .pipe(
                    mergeMap((factory) => {
                        return factory.reserve({ workersCount })
                    }),
                )
                .subscribe(() => {
                    resolve()
                })
        })
    }
}
