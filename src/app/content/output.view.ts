import { VirtualDOM } from '@youwol/flux-view'
import { OutputViewNode } from '../explorer'

/**
 * @category View
 */
export class ContentOutputView {
    /**
     *
     * @group Immutable DOM Constants
     */
    public readonly class: string = 'w-100 h-100 overflow-auto'

    /**
     *
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { view: OutputViewNode }) {
        this.children = [params.view.htmlElement]
    }
}
