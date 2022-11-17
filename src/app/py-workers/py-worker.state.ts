import { Environment, WorkerBaseState } from '../worker-base.state'
import { PyWorker, RawLog, Requirements } from '../models'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageDataExit,
    MessageEventData,
    WorkerPool,
} from './worker-pool'
import {
    dispatchWorkerMessage,
    getCdnClientSrc$,
    isCdnEventMessage,
} from './utils'
import { Context } from '../context'
import {
    getModuleNameFromFile,
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
    WorkerListener,
} from '../project'

interface EntryPointInstallArgs {
    requirements: Requirements
    exportedPyodideInstanceName: string
}

function entryPointInstall(input: EntryPointArguments<EntryPointInstallArgs>) {
    const cdn = self['@youwol/cdn-client']
    cdn.Client.HostName = window.location.origin
    return cdn
        .install({
            modules: [
                'rxjs#^6.5.5',
                ...input.args.requirements.javascriptPackages.modules,
            ],
            aliases: input.args.requirements.javascriptPackages.aliases,
            customInstallers: [
                {
                    module: '@youwol/cdn-pyodide-loader',
                    installInputs: {
                        modules: input.args.requirements.pythonPackages.map(
                            (p) => `@pyodide/${p}`,
                        ),
                        warmUp: true,
                        onEvent: (cdnEvent) => {
                            const message = {
                                type: 'CdnEvent',
                                event: cdnEvent,
                            }
                            input.context.sendData(message)
                        },
                        exportedPyodideInstanceName:
                            input.args.exportedPyodideInstanceName,
                    },
                },
            ],
        })
        .then(() => {
            const message = { type: 'installEvent', value: 'install done' }
            input.context.sendData(message)
        })
}

interface EntryPointSyncFsMapArgs {
    fsMap: Map<string, string>
    exportedPyodideInstanceName: string
}

function entryPointSyncFileSystem(
    input: EntryPointArguments<EntryPointSyncFsMapArgs>,
) {
    const pyodide = self[input.args.exportedPyodideInstanceName]
    const syncFileSystem = self['syncFileSystem']
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
        syncFileSystem(pyodide, input.args.fsMap),
        registerYwPyodideModule(pyodide, input.args.fsMap, outputs),
    ])
}

interface EntryPointExeArgs {
    content: string
    exportedPyodideInstanceName: string
    pythonGlobals: Record<string, unknown>
}

function entryPointExe(input: EntryPointArguments<EntryPointExeArgs>) {
    const pyodide = self[input.args.exportedPyodideInstanceName]
    const pythonChannel$ = new self['rxjs_APIv6'].ReplaySubject(1)
    self['getPythonChannel$'] = () => pythonChannel$

    // Need to unsubscribe following subscription at the end of the run
    pythonChannel$.subscribe((message) => {
        input.context.sendData(message)
    })
    const namespace = pyodide.toPy(input.args.pythonGlobals)
    return pyodide.runPythonAsync(input.args.content, {
        globals: namespace,
    })
}

/**
 * @category State
 */
export class PyWorkerState extends WorkerBaseState {
    /**
     * @group Observables
     */
    public readonly pyWorker$: Observable<PyWorker>

    /**
     * @group Observables
     */
    public readonly workersPool$ = new BehaviorSubject<WorkerPool>(undefined)

    /**
     * @group Observables
     */
    static cdnSrc$ = getCdnClientSrc$()

    constructor({
        pyWorker,
        rawLog$,
    }: {
        pyWorker: PyWorker
        rawLog$: Subject<RawLog>
    }) {
        super({ worker: pyWorker, rawLog$ })
        this.pyWorker$ = this.serialized$.pipe(
            map((workerCommon) => {
                return {
                    ...workerCommon,
                    inputs: [
                        {
                            name: 'input_stream',
                        },
                    ],
                    outputs: [
                        {
                            name: 'output_stream',
                        },
                    ],
                }
            }),
        )
        this.installRequirements(pyWorker.environment.requirements)
    }

    installRequirements(requirements: Requirements) {
        this.projectLoaded$.next(false)
        this.workersPool$.next(undefined)
        PyWorkerState.cdnSrc$.pipe(take(1)).subscribe((src) => {
            const title = 'install requirements'
            const context = new Context(title)
            const workersPool = new WorkerPool()
            workersPool.import({
                sources: [{ id: '@youwol/cdn-client', src }],
                functions: [
                    { id: 'syncFileSystem', target: syncFileSystem },
                    { id: 'registerJsModules', target: registerJsModules },
                    {
                        id: 'registerYwPyodideModule',
                        target: registerYwPyodideModule,
                    },
                    {
                        id: 'getModuleNameFromFile',
                        target: getModuleNameFromFile,
                    },
                ],
                variables: [],
            })
            workersPool
                .schedule({
                    title,
                    entryPoint: entryPointInstall,
                    args: {
                        requirements,
                        exportedPyodideInstanceName:
                            Environment.ExportedPyodideInstanceName,
                    },
                    context,
                })
                .pipe(
                    tap((message: MessageEventData) => {
                        const cdnEvent = isCdnEventMessage(message)
                        if (cdnEvent) {
                            this.cdnEvent$.next(cdnEvent)
                        }
                    }),
                    filter((d) => d.type == 'Exit'),
                    take(1),
                )
                .subscribe(() => {
                    this.projectLoaded$.next(true)
                    this.workersPool$.next(workersPool)
                })
        })
    }

    initializeBeforeRun(fileSystem: Map<string, string>) {
        return this.workersPool$.pipe(
            filter((pool) => pool != undefined),
            take(1),
            mergeMap((workersPool) => {
                const title = 'Synchronize file-system'
                const context = new Context(title)
                return workersPool.schedule({
                    title,
                    entryPoint: entryPointSyncFileSystem,
                    args: {
                        fsMap: fileSystem,
                        exportedPyodideInstanceName:
                            Environment.ExportedPyodideInstanceName,
                    },
                    context,
                })
            }),
            filter((d) => d.type == 'Exit'),
            take(1),
        )
    }

    execPythonSrc(
        patchedContent: string,
        pythonGlobals: Record<string, unknown> = {},
        workerListener: WorkerListener = undefined,
    ): Observable<MessageDataExit> {
        return this.workersPool$.pipe(
            filter((pool) => pool != undefined),
            take(1),
            mergeMap((workersPool) => {
                const title = 'Execute python'
                const context = new Context(title)
                return workersPool.schedule({
                    title,
                    entryPoint: entryPointExe,
                    args: {
                        content: patchedContent,
                        exportedPyodideInstanceName:
                            Environment.ExportedPyodideInstanceName,
                        pythonGlobals,
                    },
                    context,
                })
            }),
            tap((message) => {
                dispatchWorkerMessage(message, this.rawLog$, workerListener)
            }),
            filter((d) => d.type == 'Exit'),
            map((result) => result.data as unknown as MessageDataExit),
            take(1),
        )
    }

    getPythonProxy() {
        return new WorkerPoolPythonProxy({ state: this })
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
     * @group States
     */
    public readonly state: PyWorkerState

    constructor(params: { state: PyWorkerState }) {
        Object.assign(this, params)
    }

    async schedule(
        input: PythonProxyScheduleInput,
        workerChannel: WorkerListener,
    ) {
        const src = patchPythonSrc(
            '',
            `
from ${input.entryPoint.file} import ${input.entryPoint.function}       

result = ${input.entryPoint.function}(test_glob_var)
result
        `,
        )
        return new Promise((resolve) => {
            this.state
                .execPythonSrc(
                    src,
                    { test_glob_var: input.argument },
                    workerChannel,
                )
                .subscribe((messageResult: MessageDataExit) => {
                    resolve(messageResult.result)
                })
        })
    }
}
