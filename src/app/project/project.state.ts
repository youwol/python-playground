import { Project, Requirements } from '../models'
import { BehaviorSubject, merge, Observable, ReplaySubject } from 'rxjs'
import { scan } from 'rxjs/operators'
import { OutputViewNode } from '../explorer'
import { WorkerBaseState } from '../worker-base.state'
import { installRequirements } from '../load-project'

/**
 * @category State
 */
export class ProjectState extends WorkerBaseState {
    /**
     * @group Observables
     */
    public readonly project$: Observable<Project>

    /**
     * @group Observables
     */
    public readonly createdOutput$ = new ReplaySubject<OutputViewNode>(1)

    /**
     * @group Observables
     */
    public readonly createdOutputs$ = new BehaviorSubject<OutputViewNode[]>([])

    constructor({ project }: { project: Project }) {
        super({ worker: project })
        this.project$ = this.serialized$
        merge(this.runStart$, this.createdOutput$)
            .pipe(
                scan(
                    (acc, e: true | OutputViewNode) =>
                        e === true ? [] : [...acc, e],
                    [],
                ),
            )
            .subscribe((outputs) => {
                this.createdOutputs$.next(outputs)
            })

        this.installRequirements(project.environment.requirements)
    }

    run() {
        return this.runCurrentConfiguration()
    }

    installRequirements(requirements: Requirements) {
        installRequirements({
            requirements,
            cdnEvent$: this.cdnEvent$,
            rawLog$: this.rawLog$,
            environment$: this.environment$,
        }).then(() => {
            this.projectLoaded$.next(true)
        })
    }

    runCurrentConfiguration() {
        const outputs = {
            onLog: (log) => this.rawLog$.next(log),
            onView: (view) => {
                const newNode = new OutputViewNode({
                    ...view,
                    projectState: this,
                })
                this.createdOutput$.next(newNode)
            },
        }
        super.runCurrentConfiguration(outputs)
    }
}
