import {
    Environment,
    EnvironmentState,
    ExecutingImplementation,
} from '../environment.state'
import { RawLog, WorkerCommon } from '../../models'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, skip, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageDataExit,
    WorkersFactory,
} from './workers-factory'
import { dispatchWorkerMessage, objectPyToJs } from './utils'
import { Context } from '../../context'
import {
    cleanFileSystem,
    cleanJsModules,
    getModuleNameFromFile,
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
    WorkerListener,
} from '../in-worker-executable'
import {
    CdnEvent,
    getUrlBase,
    InstallLoadingGraphInputs,
    setup as cdnSetup,
} from '@youwol/cdn-client'
import { setup } from '../../../auto-generated'

interface EntryPointSyncFsMapArgs {
    exportedPyodideInstanceName: string
    exportedRxjsSymbol: string
}

function entryRegisterPyPlayAddOns(
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

    return Promise.all([registerYwPyodideModule(pyodide, outputs)])
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
    const registerJsModules = self['registerJsModules']
    const cleanFileSystem = self['cleanFileSystem']
    const cleanJsModules = self['cleanJsModules']
    const objectPyToJs = self['objectPyToJs']
    await Promise.all([
        syncFileSystem(pyodide, input.args.fileSystem),
        registerJsModules(pyodide, input.args.fileSystem),
    ])
    const sub = pythonChannel$.subscribe((message) => {
        input.context.sendData(objectPyToJs(pyodide, message))
    })
    const namespace = pyodide.toPy(input.args.pythonGlobals)
    const result = await pyodide.runPythonAsync(input.args.content, {
        globals: namespace,
    })
    sub.unsubscribe()
    return await Promise.all([
        cleanFileSystem(pyodide, input.args.fileSystem),
        cleanJsModules(pyodide, input.args.fileSystem),
    ]).then(() => {
        return objectPyToJs(pyodide, result)
    })
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
        lockFile: InstallLoadingGraphInputs,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Subject<CdnEvent>,
    ) {
        const minWorkersCount = this.capacity$.value
        const cdnPackage = '@youwol/cdn-client'
        const workersFactory = new WorkersFactory({
            cdnEvent$,
            cdnUrl: `${window.location.origin}${getUrlBase(
                cdnPackage,
                cdnSetup.version,
            )}/dist/${cdnPackage}.js`,
            functions: {
                objectPyToJs: objectPyToJs,
                syncFileSystem: syncFileSystem,
                cleanFileSystem: cleanFileSystem,
                registerJsModules: registerJsModules,
                cleanJsModules: cleanJsModules,
                registerYwPyodideModule: registerYwPyodideModule,
                getModuleNameFromFile: getModuleNameFromFile,
            },
            cdnInstallation: lockFile,
            postInstallTasks: [
                {
                    title: 'register py-play add-ons',
                    entryPoint: entryRegisterPyPlayAddOns,
                    args: {
                        exportedRxjsSymbol:
                            setup.getDependencySymbolExported('rxjs'),
                        exportedPyodideInstanceName:
                            Environment.ExportedPyodideInstanceName,
                    },
                },
            ],
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

    terminate() {
        this.workersFactory$
            .pipe(filter((factory) => factory != undefined))
            .subscribe((factory) => {
                factory.terminate()
            })
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
        input = objectPyToJs(
            self[Environment.ExportedPyodideInstanceName],
            input,
        )
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
                    filter((factory) => factory != undefined),
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
