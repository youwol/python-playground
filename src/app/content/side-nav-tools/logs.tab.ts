import { DockableTabs } from '@youwol/fv-tabs'
import { childrenAppendOnly$, VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../../project'
import { debounceTime, map } from 'rxjs/operators'
import { HTMLElement$ } from '@youwol/flux-view/dist'
import { RawLog } from '../../models'

/**
 * @category View
 */
export class LogsTab extends DockableTabs.Tab {
    constructor({ projectState }: { projectState: ProjectState }) {
        super({
            id: 'Logs',
            title: 'Logs',
            icon: '',
            content: () => {
                return {
                    style: {
                        height: '300px',
                    },
                    children: [new LogsView({ projectState })],
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
     * @group States
     */
    public readonly projectState: ProjectState

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

    constructor(params: { projectState: ProjectState }) {
        Object.assign(this, params)
        this.projectState.rawLog$
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
                    this.projectState.rawLog$.pipe(map((log) => [log])),
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
