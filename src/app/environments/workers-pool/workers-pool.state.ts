import { Environment, ExecutingImplementation } from '../environment.state'
import { RawLog, Requirements } from '../../models'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageDataExit,
    WorkersFactory,
} from './workers-factory'
import {
    dispatchWorkerMessage,
    formatCdnDependencies,
    getCdnClientSrc$,
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
import { CdnEvent, getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'

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
        const minWorkersCount = 2
        const workersFactory = new WorkersFactory({
            cdnEvent$,
            cdnUrl: `${window.location.origin}${getUrlBase(
                '@youwol/cdn-client',
                cdnSetup.version,
            )}`,
            functions: {
                syncFileSystem: syncFileSystem,
                registerJsModules: registerJsModules,
                registerYwPyodideModule: registerYwPyodideModule,
                getModuleNameFromFile: getModuleNameFromFile,
            },
            cdnInstallation: formatCdnDependencies(requirements),
        })
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
