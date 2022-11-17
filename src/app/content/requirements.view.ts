import { CodePageView } from './code-editor'
import { EnvironmentState } from '../environment.state'

/**
 * @category View
 */
export class RequirementsView extends CodePageView {
    constructor(params: { sourcePath: string; state: EnvironmentState }) {
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
