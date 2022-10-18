import { ProjectState } from '../project'
import { CodePageView } from './code-editor'

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
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
