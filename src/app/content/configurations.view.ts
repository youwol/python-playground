import { ProjectState } from '../project'
import { CodePageView } from './code-editor'

/**
 * @category View
 */
export class ConfigurationsView extends CodePageView {
    constructor(params: { sourcePath: string; projectState: ProjectState }) {
        const run = () => {
            this.projectState.applyConfigurations()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
