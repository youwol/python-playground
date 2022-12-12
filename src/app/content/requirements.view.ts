import { CodePageView } from './code-editor'
import { VirtualDOM } from '@youwol/flux-view'
import { AbstractEnvState } from '../models'

/**
 * @category View
 */
export class RequirementsView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'w-100 h-100 d-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(state: AbstractEnvState) {
        this.children = [
            {
                class: 'w-50 h-100',
                children: [
                    new RawRequirementsView({
                        sourcePath: './requirements',
                        state,
                    }),
                ],
            },
            { class: 'h-100 mx-2' },
            {
                class: 'w-50 h-100',
                children: [new LocksViewColumn(state)],
            },
        ]
    }
}

/**
 * @category View
 */
export class RawRequirementsView extends CodePageView {
    constructor(params: { sourcePath: string; state: AbstractEnvState }) {
        const run = () => {
            this.state.applyRequirements()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}

/**
 * @category View
 */
export class LocksViewColumn implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'w-100 h-100 d-flex flex-column'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(state: AbstractEnvState) {
        this.children = [
            {
                class: 'fv-bg-background-alt border rounded p-2 text-center',
                innerText:
                    'The content below is auto-generated from the raw requirements on the left side.\n ' +
                    "To update it press 'Ctrl+enter' from the editor on the left.",
            },

            { class: 'w-100 my-1' },
            {
                class: 'w-100 flex-grow-1 overflow-auto',
                style: {
                    minHeight: '0px',
                },
                children: [
                    new LocksViewEditor({
                        sourcePath: './locks',
                        state,
                    }),
                ],
            },
        ]
    }
}

/**
 * @category View
 */
export class LocksViewEditor extends CodePageView {
    constructor(params: { sourcePath: string; state: AbstractEnvState }) {
        const run = () => {
            /*no op*/
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
