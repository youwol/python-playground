import { VirtualDOM, HTMLElement$ } from '@youwol/flux-view'
import { CodeEditorView } from './code-editor.view'
import { BehaviorSubject } from 'rxjs'
import { delay, filter } from 'rxjs/operators'
import { CarouselSide } from '../../carousel-3d'
import { WorkerBaseState } from '../../worker-base.state'

/**
 * @category View
 */
export class CodePageView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly state: WorkerBaseState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'h-100 d-flex flex-column'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly headerView: VirtualDOM

    /**
     * @group Immutable Constants
     */
    public readonly onCtrlEnter: () => void

    /**
     * @group Immutable Constants
     */
    public readonly sourcePath: string

    /**
     * @group Immutable DOM Constants
     */
    connectedCallback: (htmlElement: HTMLElement$) => void

    constructor(params: {
        sourcePath: string
        state: WorkerBaseState
        headerView: VirtualDOM
        onCtrlEnter: () => void
    }) {
        Object.assign(this, params)

        const selectedSide$ = new BehaviorSubject<CarouselSide>('front')

        const codeEditorView = new CodeEditorView({
            sourcePath: this.sourcePath,
            state: this.state,
            onRun: this.onCtrlEnter,
            refresh$: selectedSide$.pipe(
                filter((side) => side == 'front'),
                delay(800),
            ),
        })

        this.children = [
            this.headerView,
            {
                class: 'flex-grow-1 w-100',
                style: {
                    minHeight: '0px',
                },
                children: [codeEditorView],
            },
        ]
    }
}
