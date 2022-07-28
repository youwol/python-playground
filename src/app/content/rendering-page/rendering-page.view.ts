import { childrenAppendOnly$, VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../../project'
import { map } from 'rxjs/operators'
import { HeaderBannerView, HeaderBtnView } from '../code-editor'

/**
 * @category View
 */
export class RenderingPageView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'w-100 h-100 fv-bg-background d-flex flex-column'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { projectState: ProjectState }) {
        Object.assign(this, params)
        this.children = [
            new HeaderBannerView({
                children: [
                    new HeaderBtnView({
                        icon: 'fab fa-creative-commons-zero',
                        onClick: () => {
                            document.querySelector(
                                '.displayed-elements-container',
                            ).innerHTML = ''
                        },
                    }),
                ],
            }),
            {
                class: 'w-100 h-100 overflow-auto flex-grow-1 displayed-elements-container',
                children: childrenAppendOnly$(
                    this.projectState.displayElement$.pipe(map((e) => [e])),
                    (elem) => {
                        return {
                            children: [
                                {
                                    tag: 'h2',
                                    innerText: elem.title,
                                },
                                elem.htmlElement,
                            ],
                        }
                    },
                ),
            },
        ]
    }
}
