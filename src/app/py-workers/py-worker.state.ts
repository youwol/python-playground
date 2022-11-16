import { WorkerBaseState } from '../worker-base.state'
import { PyWorker, Requirements } from '../models'
import { BehaviorSubject, Observable } from 'rxjs'
import { filter, map, take } from 'rxjs/operators'
import { EntryPointArguments, WorkerPool } from './worker-pool'
import { getCdnClientSrc$ } from './utils'
import { Context } from '../context'

interface EntryPointInstallArgs {
    requirements: Requirements
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
                                type: 'installEvent',
                                value: cdnEvent,
                            }
                            input.context.sendData(message)
                        },
                        exportedPyodideInstanceName: 'tutu',
                    },
                },
            ],
        })
        .then(() => {
            const message = { type: 'installEvent', value: 'install done' }
            input.context.sendData(message)
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

    public readonly workersPool = new BehaviorSubject<WorkerPool>(undefined)

    static cdnSrc$ = getCdnClientSrc$()

    constructor({ pyWorker }: { pyWorker: PyWorker }) {
        super({ worker: pyWorker })
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

    run() {
        // no op for now
    }

    installRequirements(requirements: Requirements) {
        this.projectLoaded$.next(false)
        this.workersPool.next(undefined)
        PyWorkerState.cdnSrc$.pipe(take(1)).subscribe((src) => {
            const title = 'install requirements'
            const context = new Context(title)
            const workersPool = new WorkerPool()
            workersPool.import({
                sources: [{ id: '@youwol/cdn-client', src }],
                functions: [],
                variables: [],
            })
            workersPool
                .schedule({
                    title,
                    entryPoint: entryPointInstall,
                    args: {
                        requirements,
                    },
                    context,
                })
                .pipe(filter((d) => d.type == 'Exit'))
                .subscribe(() => {
                    this.projectLoaded$.next(true)
                    this.workersPool.next(workersPool)
                })
        })
    }
}
