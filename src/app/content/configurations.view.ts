import { CodePageView } from './code-editor'
import { AbstractEnvState } from '../models'

/**
 * @category View
 */
export class ConfigurationsView extends CodePageView {
    constructor(params: { sourcePath: string; state: AbstractEnvState }) {
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
