import { WorkerBaseState } from '../worker-base.state'
import { PyWorker } from '../models'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * @category State
 */
export class PyWorkerState extends WorkerBaseState {
    /**
     * @group Observables
     */
    public readonly pyWorker$: Observable<PyWorker>

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
    }
}
