import { VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../project'
import { CodeEditorView, HeaderBannerView, HeaderBtnView } from './code-editor'

/**
 * @category View
 */
export class ConfigurationsView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly projectState: ProjectState
    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'h-100'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    /**
     *
     * @group Immutable Constants
     */
    public readonly sourcePath: string

    constructor(params: { sourcePath: string; projectState: ProjectState }) {
        Object.assign(this, params)
        const apply = () => {
            this.projectState.applyConfigurations()
        }
        this.children = [
            new HeaderBannerView({
                children: [
                    new HeaderBtnView({
                        projectState: this.projectState,
                        icon: 'fas fa-check',
                        onClick: apply,
                    }),
                ],
            }),
            new CodeEditorView({
                sourcePath: this.sourcePath,
                projectState: this.projectState,
                onRun: apply,
            }),
        ]
    }
}
