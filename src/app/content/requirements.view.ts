import { CodePageView } from './code-editor'
import { WorkerBaseState } from '../worker-base.state'

/**
 * @category View
 */
export class RequirementsView extends CodePageView {
    constructor(params: { sourcePath: string; state: WorkerBaseState }) {
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
