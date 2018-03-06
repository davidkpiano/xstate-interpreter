import { Observable } from 'rxjs/Observable'
import { of } from 'rxjs/observable/of'
import { merge } from 'rxjs/observable/merge'
import { empty } from 'rxjs/observable/empty'
import { map } from 'rxjs/operators/map'
import { delay } from 'rxjs/operators/delay'
import { tap } from 'rxjs/operators/tap'
import { pluck } from 'rxjs/operators/pluck'
import { filter } from 'rxjs/operators/filter'
import { startWith } from 'rxjs/operators/startWith'
import { takeUntil } from 'rxjs/operators/takeUntil'
import { mergeMap } from 'rxjs/operators/mergeMap'
import { concatMap } from 'rxjs/operators/concatMap'

import { Subject } from 'rxjs/Subject'
import { scan } from 'rxjs/operators/scan'
import { StateNode, State, Machine, actions } from 'xstate'
import {
  Event,
  Action,
  ActionObject,
  SendAction,
  EventObject,
  CancelAction
} from 'xstate/lib/types'
import { toEventObject } from '../../xstate/lib/actions'

const { actionTypes } = actions

export class Interpreter {
  event$: Subject<EventObject>
  state$: Observable<State>
  action$: Observable<Action>

  constructor(public machine: StateNode) {
    this.event$ = new Subject()
    this.state$ = this.event$.pipe(
      filter(event => machine.handles(event)),
      scan((state: State, event: Event) => {
        return this.machine.transition(state, event)
      }, machine.initialState),
      startWith(machine.initialState)
    )
    this.action$ = this.state$.pipe(
      pluck<State, Action[]>('actions'),
      concatMap(actions => {
        return of(...actions)
      })
    )
    this.action$
      .pipe(
        mergeMap(action => {
          return Interpreter.getActionCreator(action)(this.event$)
        })
      )
      .subscribe(e => this.event$.next(e))
  }

  static getActionCreator(
    action: Action
  ): (event$: Observable<EventObject>) => Observable<EventObject> {
    const actionType =
      typeof action === 'string' || typeof action === 'number' ? action : action.type

    switch (actionType) {
      case actionTypes.send:
        action = action as SendAction
        return Interpreter.delay(action.event, action.delay, action.id)
      case actionTypes.cancel:
        return () => of(action as CancelAction)
      default:
        return () => empty()
    }
  }

  static delay(
    event: EventObject,
    timeout: number,
    id: string
  ): (event$: Observable<EventObject>) => Observable<EventObject> {
    return event$ => {
      return of(event).pipe(
        delay(timeout),
        takeUntil(
          event$.pipe(
            filter(event => {
              return event.type === actionTypes.cancel && (event as CancelAction).sendId === id
            })
          )
        )
      )
    }
  }

  public send(event: Event): void {
    const eventObject = toEventObject(event)
    this.event$.next(eventObject)
  }
}

;(window as any).Interpreter = Interpreter
;(window as any).Machine = Machine
