import { Environment, WorkerBaseState } from '../worker-base.state'
import { PyWorker, RawLog, Requirements } from '../models'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, mergeMap, take, tap } from 'rxjs/operators'
import {
    EntryPointArguments,
    MessageEventData,
    WorkerPool,
} from './worker-pool'
import { getCdnClientSrc$, isCdnEventMessage } from './utils'
import { Context } from '../context'
import { registerJsModules, syncFileSystem } from '../project'

interface EntryPointInstallArgs {
    requirements: Requirements
    exportedPyodideInstanceName: string
}

function entryPointInstall(input: EntryPointArguments<EntryPointInstallArgs>) {
    const cdn = self['@youwol/cdn-client']
    cdn.Client.HostName = window.location.origin
    return cdn
        .install({
            ...input.args.requirements.javascriptPackages,
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
    console.log('entryPointSyncFileSystem', {
        pyodide,
        fsMap: input.args.fsMap,
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

    execPythonSrc(patchedContent: string) {
        console.log('execPythonSrc', patchedContent)
    }
}
