import { DockableTabs } from '@youwol/fv-tabs'
import { AppState } from '../app.state'
import { TreeView } from '../explorer'

/**
 * @category View
 */
export class ProjectTab extends DockableTabs.Tab {
    constructor({ appState }: { appState: AppState }) {
        super({
            id: 'Project',
            title: 'Project',
            icon: '',
            content: () => {
                return {
                    style: {
                        width: '300px',
                    },
                    children: [
                        new TreeView({
                            state: appState.explorerState,
                        }),
                    ],
                }
            },
        })
    }
}
