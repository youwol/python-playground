import { ContextMenu } from '@youwol/fv-context-menu'
import { fromEvent, Observable } from 'rxjs'
import { filter, map, tap } from 'rxjs/operators'

import {
    ALL_ACTIONS,
    ContextRootNode,
    ContextTreeNode,
    ExecutableNode,
    isExecutable,
} from './context-menu.nodes'
import { ImmutableTree } from '@youwol/fv-tree'
import { child$, HTMLElement$, VirtualDOM } from '@youwol/flux-view'
import { AppState } from '../../app.state'
import { TreeState } from '../tree.view'
import { Node, ProjectNode, SourceNode } from '../nodes'

/**
 * Logic side of [[ContextMenuView]]
 *
 * @category State
 */
export class ContextMenuState extends ContextMenu.State {
    /**
     * @group States
     */
    public readonly appState: AppState
    /**
     * @group States
     */
    public readonly explorerState: TreeState
    /**
     * @group Immutable Constants
     */
    public readonly explorerDiv: HTMLDivElement

    constructor({
        appState,
        explorerState,
        explorerDiv,
    }: {
        appState: AppState
        explorerState: TreeState
        explorerDiv: HTMLDivElement
    }) {
        super(
            fromEvent(explorerDiv, 'contextmenu').pipe(
                tap((ev: Event) => ev.preventDefault()),
            ) as Observable<MouseEvent>,
        )
        this.appState = appState
        this.explorerState = explorerState
        this.explorerDiv = explorerDiv
    }

    dispatch(_ev: MouseEvent): VirtualDOM {
        return {
            style: {
                zIndex: 1,
            },
            children: [
                child$(this.explorerState.selectedNode$, (node: Node) => {
                    return new ContextMenuView({
                        state: this,
                        selectedNode: node,
                    })
                }),
            ],
        }
    }
}

/**
 * Context-menu view
 *
 * @category View
 */
export class ContextMenuView implements VirtualDOM {
    /**
     * @category Immutables DOM Constants
     */
    public readonly id = 'context-menu-view'

    /**
     * @category Immutables DOM Constants
     */
    public readonly children: Array<VirtualDOM>

    /**
     * @category Immutables Constants
     */
    public readonly connectedCallback: (
        element: HTMLElement$ & HTMLDivElement,
    ) => void

    /**
     * @category States
     */
    public readonly state: ContextMenuState

    /**
     * @category Immutables Constants
     */
    public readonly selectedNode: Node

    constructor(params: { state: ContextMenuState; selectedNode: Node }) {
        Object.assign(this, params)

        const actionViews = Object.values(ALL_ACTIONS)
            .filter((action) => action.applicable(this.selectedNode))
            .map((action) =>
                action.createNode(
                    this.selectedNode as ProjectNode & SourceNode,
                    this.state.explorerState,
                ),
            )

        const rootNode = new ContextRootNode({ children: actionViews })
        const contextTreeState = new ImmutableTree.State<ContextTreeNode>({
            rootNode,
            expandedNodes: [rootNode.id],
        })
        contextTreeState.selectedNode$.next(rootNode)

        this.children = [
            new ImmutableTree.View({
                state: contextTreeState,
                headerView: (_, node) => headerView(node),
                class: 'fv-bg-background fv-text-primary p-2 rounded border fv-color-primary',
            }),
        ]
        this.connectedCallback = (
            htmlElement: HTMLElement$ & HTMLDivElement,
        ) => {
            const sub = contextTreeState.selectedNode$
                .pipe(
                    filter((node) => isExecutable(node)),
                    map((node) => node as unknown as ExecutableNode),
                )
                .subscribe((node) => {
                    htmlElement.remove()
                    node.execute(this.state)
                })
            htmlElement.ownSubscriptions(sub)
        }
    }
}

/**
 * Creates context menu tree-view's node view
 * @param node context menu node
 * @returns the view
 * @category View
 */
function headerView(node: ContextTreeNode): VirtualDOM {
    return {
        class: 'd-flex w-100 align-items-baseline fv-pointer fv-hover-bg-background-alt px-1',
        children: [
            { tag: 'i', class: node.faIcon },
            {
                tag: 'span',
                class: 'mx-2 w-100',
                innerText: node.name,
                style: { 'user-select': 'none' },
            },
        ],
    }
}
