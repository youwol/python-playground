import { VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../../project'

/**
 * @category View
 */
export class HeaderBannerView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex w-100 fv-bg-background-alt'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { children: VirtualDOM[] }) {
        Object.assign(this, params)
    }
}
/**
 * @category View
 */
export class HeaderBtnView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group State
     */
    public readonly projectState: ProjectState

    constructor(params: {
        projectState: ProjectState
        icon: string
        onClick: (ev) => void
    }) {
        Object.assign(this, params)

        this.children = [
            {
                class: 'ml-3 mr-2',
                children: [
                    {
                        class: 'fv-btn fv-pointer fv-text-success rounded fv-bg-background-alt fv-border fv-hover-xx-lighter py-0 px-1',
                        children: [
                            {
                                class: params.icon,
                            },
                        ],
                        onclick: params.onClick,
                    },
                ],
            },
        ]
    }
}
