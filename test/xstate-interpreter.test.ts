import { Interpreter } from '../src/xstate-interpreter'
import { Machine } from 'xstate'

describe('Interpreter', () => {
  it('should create a new Interpreter', async () => {
    const machine = Machine({
      initial: 'a',
      states: {
        a: {
          on: { EVENT: 'b' }
        },
        b: {
          on: { EVENT: 'a' }
        }
      }
    })

    const interpreter = new Interpreter(machine)

    interpreter.state$.subscribe(state => console.log(state))

    interpreter.send('EVENT')

    interpreter.event$.next('EVENT')

    console.log('hi')

    await new Promise(res =>
      setTimeout(() => {
        res()
      }, 10000)
    )

    expect(interpreter).not.toBeUndefined()
  })
})
