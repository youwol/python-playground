import { VirtualDOM, HTMLElement$ } from '@youwol/flux-view'
import { CodeEditorView } from './code-editor.view'
import {
    EnvironmentState,
    ExecutingImplementation,
} from '../../environments/environment.state'

/**
 * @category View
 */
export class CodePageView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly state: EnvironmentState<ExecutingImplementation>

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
        state: EnvironmentState<ExecutingImplementation>
        headerView: VirtualDOM
        onCtrlEnter: () => void
    }) {
        Object.assign(this, params)

        const codeEditorView = new CodeEditorView({
            sourcePath: this.sourcePath,
            state: this.state,
            onRun: this.onCtrlEnter,
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
