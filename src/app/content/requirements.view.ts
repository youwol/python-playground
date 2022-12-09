import { CodePageView } from './code-editor'
import {
    EnvironmentState,
    ExecutingImplementation,
} from '../environments/environment.state'
import { VirtualDOM } from '@youwol/flux-view'

export class RequirementsView implements VirtualDOM {
    public readonly class = 'w-100 h-100 d-flex'
    public readonly children: VirtualDOM[]

    constructor(state: EnvironmentState<ExecutingImplementation>) {
        this.children = [
            {
                class: 'w-50 h-100',
                children: [
                    new RawRequirementsView({
                        sourcePath: './requirements',
                        state,
                    }),
                ],
            },
            {
                class: 'w-50 h-100',
                children: [
                    new LocksView({
                        sourcePath: './locks',
                        state,
                    }),
                ],
            },
        ]
    }
}
/**
 * @category View
 */
export class RawRequirementsView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState<ExecutingImplementation>
    }) {
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

export class LocksView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: EnvironmentState<ExecutingImplementation>
    }) {
        const run = () => {
            /*no op*/
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}
