import {
    AssetsGateway,
    raiseHTTPErrors,
    FilesBackend,
} from '@youwol/http-clients'
import {BehaviorSubject, ReplaySubject} from 'rxjs'
import { Project } from './models'
import { ChildApplicationAPI } from '@youwol/os-core'
import { DockableTabs } from '@youwol/fv-tabs'
import { ProjectTab } from './side-nav-explorer'
import { mergeMap, skip } from 'rxjs/operators'
import { ProjectState } from './project'
import { OutputViewsTab } from "./side-nav-explorer/output-views.tab";
import { Node, OutputViewNode } from './explorer'
/**
 *
 * @category State
 */
export class AppState {

    /**
     * @group States
     */
    public readonly rightSideNavState: DockableTabs.State


    /**
     * @group States
     */
    public readonly leftSideNavState: DockableTabs.State


    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly fileInfo: FilesBackend.GetInfoResponse

    /**
     * @group Observables
     */
    public readonly selected$ = new ReplaySubject<Node>(1)

    constructor(params: {
        project: Project
        fileInfo: FilesBackend.GetInfoResponse
    }) {
        Object.assign(this, params)

        this.projectState = new ProjectState({
            project: params.project,
        })
        this.leftSideNavState = new DockableTabs.State({
            disposition: 'left',
            viewState$: new BehaviorSubject<DockableTabs.DisplayMode>('pined'),
            tabs$: new BehaviorSubject([new ProjectTab({ appState: this })]),
            selected$: new BehaviorSubject<string>('Project'),
        })

        this.rightSideNavState = new DockableTabs.State({
            disposition: 'right',
            viewState$: new BehaviorSubject<DockableTabs.DisplayMode>('collapsed'),
            tabs$: new BehaviorSubject([new OutputViewsTab({ appState: this })]),
            selected$: new BehaviorSubject<string>('Views'),
        })
        this.projectState.explorerState.selectedNode$.subscribe((node) => {
            this.selected$.next(node)
        })

        ChildApplicationAPI.setProperties({
            snippet: {
                class: 'd-flex align-items-center px-1',
                children: [
                    {
                        class: '<i class="fab fa-python"></i> mr-1',
                    },
                    {
                        innerText: this.fileInfo.metadata.fileName,
                    },
                ],
            },
        })
        this.projectState.project$
            .pipe(
                skip(1),
                mergeMap((project) => {
                    const filesClient = new AssetsGateway.Client().files
                    const str = JSON.stringify(project, null, 4)
                    const bytes = new TextEncoder().encode(str)
                    const blob = new Blob([bytes], {
                        type: 'application/json;charset=utf-8',
                    })
                    return filesClient.upload$({
                        body: {
                            fileName: this.fileInfo.metadata.fileName,
                            fileId: project.id,
                            content: blob,
                        },
                        queryParameters: {},
                    })
                }),
                raiseHTTPErrors(),
            )
            .subscribe((asset) => {
                console.log('Saved!', asset)
            })
    }

    openView( output: OutputViewNode){
        this.selected$.next(output)
    }
}
