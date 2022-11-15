import { CodePageView } from './code-editor'
import { WorkerBaseState } from '../worker-base.state'

/**
 * @category View
 */
export class ConfigurationsView extends CodePageView {
    constructor(params: { sourcePath: string; state: WorkerBaseState }) {
        const run = () => {
            this.state.applyConfigurations()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
