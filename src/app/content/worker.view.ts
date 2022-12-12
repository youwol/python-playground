import {
    attr$,
    children$,
    childrenWithReplace$,
    VirtualDOM,
} from '@youwol/flux-view'
import { CdnEvent } from '@youwol/cdn-client'
import { distinctUntilChanged, map } from 'rxjs/operators'
import { ConfigurationSelectorView } from '../top-banner'
import { WorkersPoolState, CdnEventWorker } from '../models'

function isWorkerEvent(event: CdnEvent): event is CdnEventWorker {
    return event['workerId'] != undefined
}

/**
 * @category View
 */
export class WorkerView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100 d-flex flex-column'

    /**
     * @group States
     */
    workerState: WorkersPoolState

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { workerState: WorkersPoolState }) {
        Object.assign(this, params)
        const eqSet = (xs, ys) =>
            xs.size === ys.size && [...xs].every((x) => ys.has(x))

        const workerIds$ = this.workerState.cdnEvents$.pipe(
            map(
                (events) =>
                    new Set(
                        events
                            .filter((event) => isWorkerEvent(event))
                            .map((e: CdnEventWorker) => e.workerId),
                    ),
            ),
            distinctUntilChanged(eqSet),
        )

        this.children = [
            new PoolSizeSelectorView({ workersPoolState: this.workerState }),
            {
                class: 'w-100 d-flex flex-grow-1 p-2 flex-wrap',
                children: children$(workerIds$, (workerIds) => {
                    return [...workerIds].map((workerId) => {
                        return new WorkerCard({
                            workerId,
                            workersPoolState: this.workerState,
                        })
                    })
                }),
            },
        ]
    }
}

/**
 * @category View
 */
export class PoolSizeSelectorView {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'p-2 m-2 d-flex align-items-center'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group States
     */
    public readonly workersPoolState: WorkersPoolState

    constructor(params: { workersPoolState: WorkersPoolState }) {
        Object.assign(this, params)
        this.children = [
            {
                innerText: 'Capacity:',
            },
            {
                tag: 'select',
                class: 'mx-2',
                onchange: (ev) => {
                    console.log('Set capacity', ev.target.value)
                    this.workersPoolState.executingImplementation.capacity$.next(
                        parseInt(ev.target.value),
                    )
                },
                children: children$(
                    this.workersPoolState.executingImplementation.capacity$,
                    (selected) => {
                        return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => {
                            return {
                                tag: 'option',
                                value: value,
                                innerText: value,
                                selected: value == selected,
                            }
                        })
                    },
                ),
            },
        ]
    }
}

/**
 * @category View
 */
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
        width: 'fit-content',
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
    public readonly workersPoolState: WorkersPoolState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolState
    }) {
        Object.assign(this, params)
        this.children = [
            new WorkerCardTitleView(params),
            new ConfigurationSelectorView({
                state: this.workersPoolState,
                onRun: () => this.workersPoolState.run(),
            }),
            {
                class: 'p-2',
                children: childrenWithReplace$(
                    this.workersPoolState.cdnEvents$.pipe(
                        map((cdnEvents: CdnEvent[]) => {
                            return cdnEvents.filter((event) =>
                                isWorkerEvent(event),
                            )
                        }),
                        map((cdnWorkerEvents: CdnEventWorker[]) => {
                            const filtered = cdnWorkerEvents.filter(
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

/**
 * @category View
 */
export class WorkerCardTitleView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex align-items-center'

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
    public readonly workersPoolState: WorkersPoolState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolState
    }) {
        Object.assign(this, params)
        this.children = [
            {
                tag: 'h3',
                innerText: `Worker ${this.workerId}`,
            },
            {
                class: attr$(
                    this.workersPoolState.executingImplementation.busyWorkers$,
                    (busyWorkers) =>
                        busyWorkers.includes(this.workerId)
                            ? 'fas fa-play fv-text-success fv-blink mx-2'
                            : '',
                ),
            },
        ]
    }
}
