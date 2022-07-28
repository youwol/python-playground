import { ProjectState } from '../project'
import { CodePageView, HeaderBannerView, HeaderBtnView } from './code-editor'

/**
 * @category View
 */
export class RequirementsView extends CodePageView {
    constructor(params: { sourcePath: string; projectState: ProjectState }) {
        const run = () => {
            this.projectState.applyRequirements()
        }
        super({
            ...params,
            headerView: new HeaderBannerView({
                children: [
                    new HeaderBtnView({
                        icon: 'fas fa-check',
                        onClick: run,
                    }),
                ],
            }),
            onCtrlEnter: run,
        })
    }
}
