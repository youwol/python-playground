import { DockableTabs } from '@youwol/fv-tabs'
import {
    childrenAppendOnly$,
    VirtualDOM,
    HTMLElement$,
} from '@youwol/flux-view'
import { debounceTime, map } from 'rxjs/operators'
import { RawLog } from '../models'
import { Observable } from 'rxjs'

/**
 * @category View
 */
export class LogsTab extends DockableTabs.Tab {
    constructor({ rawLog$ }: { rawLog$: Observable<RawLog> }) {
        super({
            id: 'Logs',
            title: 'Logs',
            icon: '',
            content: () => {
                return {
                    style: {
                        height: '300px',
                    },
                    children: [new LogsView({ rawLog$: rawLog$ })],
                }
            },
        })
    }
}

/**
 * @category View
 */
export class LogsView implements VirtualDOM {
    /**
     *
     * @group Observables
     */
    public readonly rawLog$: Observable<RawLog>

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'h-100'

    /**
     * @group Immutable DOM Constants
     */
    public readonly style = {
        color: 'rgba(255,255,255,0.8)',
        fontFamily: 'monospace',
    }

    /**
     * This html element is updated each time this view is actually inserted into the DOM.
     * It points to the container of logs that has the vertical scroll-bar, and is used
     * to scroll down to the bottom whenever new messages are appended (with a debounce time on messages).
     *
     * @group Mutable
     */
    private htmlElement: HTMLDivElement & HTMLElement$

    constructor(params: { rawLog$: Observable<RawLog> }) {
        Object.assign(this, params)
        this.rawLog$
            .pipe(debounceTime(100))
            .subscribe(
                () =>
                    this.htmlElement &&
                    this.htmlElement.scrollTo(0, this.htmlElement.scrollHeight),
            )

        this.children = [
            {
                class: 'h-100 overflow-auto',
                children: childrenAppendOnly$(
                    this.rawLog$.pipe(map((log) => [log])),
                    (log: RawLog) => {
                        return {
                            class: log.level == 'error' ? 'fv-text-error' : '',
                            innerText: `> ${log.message}`,
                        }
                    },
                ),
                connectedCallback: (
                    htmlElement: HTMLDivElement & HTMLElement$,
                ) => {
                    this.htmlElement = htmlElement
                },
            },
        ]
    }
}
