import { VirtualDOM, children$ } from '@youwol/flux-view'
import { AppState } from '../app.state'
import { map } from 'rxjs/operators'
import { ProjectState } from '../project'
import { InstallMessageEvent, InstallStep } from '../models'
import { groupBy } from 'lodash'

/**
 * @category View
 */
export class ProjectView implements VirtualDOM {
    /**
     * @group Factories
     */
    static ProcessTypeFactory: Record<InstallStep, string> = {
        queued: 'fas fa-clock fv-blink',
        loading: 'fas fa-cloud-download-alt fv-blink',
        loaded: 'fas fa-check fv-text-success',
        installing: 'fas fa-cog fa-spin',
        installed: 'fas fa-check fv-text-success',
    }

    /**
     * @group States
     */
    projectState: ProjectState

    /**
     * @group States
     */
    appState: AppState

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]
    constructor(params: { projectState: ProjectState; appState: AppState }) {
        Object.assign(this, params)
        this.children = [
            {
                style: {
                    //width: 'fit-content',
                },
                class: 'mx-auto container w-50',
                children: children$(
                    this.projectState.accInstallMessages$.pipe(
                        map((messages) =>
                            getLatestInstallEventByPackages(messages),
                        ),
                    ),
                    (messages: { [k: string]: InstallMessageEvent[] }) => {
                        return Object.entries(messages).map(
                            ([_, packageMessages]) => {
                                const last = packageMessages.slice(-1)[0]
                                return {
                                    class: 'd-flex align-items-center row',
                                    children: [
                                        {
                                            class: 'col-8',
                                            innerText: `${last.packageName}`,
                                        },
                                        {
                                            class: 'col-4',
                                            children: [
                                                {
                                                    class: ProjectView
                                                        .ProcessTypeFactory[
                                                        last.step
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                }
                            },
                        )
                    },
                ),
            },
        ]
    }
}

function getLatestInstallEventByPackages(messages: InstallMessageEvent[]) {
    return groupBy(messages, (message) => message.packageName)
}
