import { CodePageView } from './code-editor'
import { attr$, child$, VirtualDOM } from '@youwol/flux-view'
import { AbstractEnvState } from '../models'
import { BehaviorSubject } from 'rxjs'

type Mode = 'edition' | 'lock'

/**
 * @category View
 */
export class RequirementsView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'w-100 h-100 d-flex flex-column'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(state: AbstractEnvState) {
        const selectedMode$ = new BehaviorSubject<Mode>('edition')
        this.children = [
            new RequirementsHeaderView(selectedMode$),
            {
                class: 'flex-grow-1 overflow-auto',
                children: [
                    child$(selectedMode$, (mode) =>
                        mode == 'edition'
                            ? new RawRequirementsView({
                                  sourcePath: './requirements',
                                  state,
                              })
                            : new LocksViewColumn(state),
                    ),
                ],
            },
        ]
    }
}

/**
 * @category View
 */
export class RequirementsHeaderView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex align-items-center p-2'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(selectedMode$: BehaviorSubject<Mode>) {
        this.children = [
            {
                class: attr$(
                    selectedMode$,
                    (mode): string =>
                        mode == 'edition' ? 'fv-text-focus' : '',
                    { wrapper: (d) => `${d} fas fa-cube fv-pointer` },
                ),
                onclick: () => selectedMode$.next('edition'),
            },
            { class: 'mx-2' },
            {
                class: attr$(
                    selectedMode$,
                    (mode): string => (mode == 'lock' ? 'fv-text-focus' : ''),
                    { wrapper: (d) => `${d} fas fa-lock fv-pointer` },
                ),
                onclick: () => selectedMode$.next('lock'),
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
            cmOptions: {
                readOnly: true,
            },
        })
    }
}
