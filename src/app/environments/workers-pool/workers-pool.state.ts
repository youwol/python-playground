import { Environment, ExecutingImplementation } from '../environment.state'
import { RawLog, Requirements } from '../../models'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageDataExit,
    MessageEventData,
    WorkersFactory,
} from './workers-factory'
import {
    dispatchWorkerMessage,
    getCdnClientSrc$,
    isCdnEventMessage,
    objectPyToJs,
} from './utils'
import { Context } from '../../context'
import {
    getModuleNameFromFile,
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
    WorkerListener,
} from '../in-worker-executable'
import { CdnEvent } from '@youwol/cdn-client'

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
    static cdnSrc$ = getCdnClientSrc$()

    installRequirements(
        requirements: Requirements,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Subject<CdnEvent>,
    ) {
        this.workersFactory$.next(undefined)
        return WorkersPoolImplementation.cdnSrc$.pipe(
            take(1),
            mergeMap((src) => {
                const title = 'install requirements'
                const context = new Context(title)
                const workersPool = new WorkersFactory()
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
                return workersPool
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
                                cdnEvent$.next(cdnEvent)
                            }
                        }),
                        filter((d) => d.type == 'Exit'),
                        take(1),
                        tap(() => {
                            this.workersFactory$.next(workersPool)
                        }),
                    )
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

    execPythonCode(
        code: string,
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

    getPythonProxy(rawLog$: Subject<RawLog>) {
        return new WorkerPoolPythonProxy({ exeEnv: this, rawLog$ })
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
    public readonly exeEnv: WorkersPoolImplementation

    /**
     * @group Observables
     */
    public readonly rawLog$: Subject<RawLog>

    constructor(params: {
        exeEnv: WorkersPoolImplementation
        rawLog$: Subject<RawLog>
    }) {
        Object.assign(this, params)
    }

    async schedule(
        input: PythonProxyScheduleInput,
        workerChannel: WorkerListener,
    ) {
        input = objectPyToJs(input)

        const src = patchPythonSrc(`
from ${input.entryPoint.file} import ${input.entryPoint.function}       
result = ${input.entryPoint.function}(test_glob_var)
result
        `)
        return new Promise((resolve) => {
            this.exeEnv
                .execPythonCode(
                    src,
                    this.rawLog$,
                    { test_glob_var: input.argument },
                    workerChannel,
                )
                .subscribe((messageResult: MessageDataExit) => {
                    resolve(messageResult.result)
                })
        })
    }
}
