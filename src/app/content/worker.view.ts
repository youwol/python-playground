import { children$, childrenWithReplace$, VirtualDOM } from '@youwol/flux-view'

import {
    WorkersPoolImplementation,
    CdnEventWorker,
} from '../environments/workers-pool'
import { distinctUntilChanged, map } from 'rxjs/operators'
import { EnvironmentState } from '../environments/environment.state'

/**
 * @category View
 */
export class WorkerView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100 d-flex p-2 flex-wrap'

    /**
     * @group States
     */
    workerState: EnvironmentState<WorkersPoolImplementation>

    /**
     * @group Immutable DOM Constants
     */
    public readonly children

    constructor(params: {
        workerState: EnvironmentState<WorkersPoolImplementation>
    }) {
        Object.assign(this, params)
        const eqSet = (xs, ys) =>
            xs.size === ys.size && [...xs].every((x) => ys.has(x))

        const workerIds$ = this.workerState.cdnEvents$.pipe(
            map(
                (events) =>
                    new Set(events.map((e: CdnEventWorker) => e.workerId)),
            ),
            distinctUntilChanged(eqSet),
        )

        this.children = children$(workerIds$, (workerIds) => {
            return [...workerIds].map((workerId) => {
                return new WorkerCard({
                    workerId,
                    workersPoolState: this.workerState,
                })
            })
        })
    }
}

export class WorkerCard implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'p-2 m-2 rounded border'

    /**
     * @group Immutable DOM Constants
     */
    public readonly style = {
        height: 'fit-content',
    }

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable Constants
     */
    public readonly workerId: string

    /**
     * @group States
     */
    public readonly workersPoolState: EnvironmentState<WorkersPoolImplementation>

    constructor(params: {
        workerId: string
        workersPoolState: EnvironmentState<WorkersPoolImplementation>
    }) {
        Object.assign(this, params)
        this.children = [
            {
                tag: 'h3',
                innerText: `Worker ${this.workerId}`,
            },
            {
                class: 'p-2',
                children: childrenWithReplace$(
                    this.workersPoolState.cdnEvents$.pipe(
                        map((cdnEvents: CdnEventWorker[]) => {
                            const filtered = cdnEvents.filter(
                                (cdnEvent) =>
                                    cdnEvent.workerId == this.workerId,
                            )
                            const ids = new Set(filtered.map((f) => f.id))
                            const reversed = filtered.reverse()
                            return [...ids].map((id) =>
                                reversed.find((event) => event.id == id),
                            )
                        }),
                    ),
                    (cdnEvent: CdnEventWorker) => {
                        return {
                            innerText: cdnEvent.text,
                        }
                    },
                ),
            },
        ]
    }
}
