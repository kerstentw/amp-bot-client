import { orderbook } from 'amp-node-api-client'
import client from './amp-client'
import * as binance from './binance'
import { gauss, getPricePoints } from '../utils'


export const add_order = query => {
  let ord = {
    amount: 0.001,
    price: 0.001,
    userAddress: "0xf2934427c36ba897f9be6ed554ed2dbce3da1c68",
    exchangeAddress: "0x2768f1543ec9145cb680fc9699672c1a3226346d",
    makeFee: 0,
    takeFee: 0,
    side: "BUY",
    baseTokenAddress: "0x194f4ec528eba59c3b73b05af044e97bc11c292a",
    quoteTokenAddress: "0xa3f9eacdb960d33845a4b004974feb805e05c4a9",
  }
  Object.assign(ord, query)

  return client.new_order(ord)
}


export const cancel_all = _ => {
  let cancels = client.my_orders()
    .filter( ele => ele.status!="FILLED" && ele.status!="CANCELLED")
    .map( order => client.cancel_order(order.hash) )

  return Promise.all(cancels)
}



const getPricesForPair = pair => {
  return binance.getPrice(pair.baseTokenSymbol)
    .then( price => {
      return { address: pair.baseTokenAddress, prices: price }
    })
}


const cancelOrdersForPair = tok => {
  let myorders = Object.values(orderbook)
    .filter( ord => ord.status!="CANCELLED" && ord.status!="FILLED" )
  let cancels = myorders.filter( ord => ord.baseToken === tok.address )
    .map( ord => client.cancel_order(ord.hash))

  return Promise.all( cancels ).then( _ => tok )
}


const prepOrdersForPair = tok => {
  let mid = getPricePoints(tok.prices[0].ave).add(getPricePoints(tok.prices[1].ave)).div(2)
  let orders = []

  tok.prices.forEach( (price, ind) => {
    [-2,-1.5,-1,-0.5,0,0.5,1,1.5,2].filter( ds => {
      let xx = getPricePoints(price.ave + ds*price.dev)
      return ind===0 ? xx.add(2).lt(mid) : xx.sub(2).gt(mid)
    })
    .forEach( ds => {
      let xx = price.ave + ds*price.dev
      let yy = gauss(xx, price.ave, price.dev)

      orders.push({
        amount: 0.01*yy/gauss(price.ave, price.ave, price.dev)/xx,
        price: xx,
        userAddress: client.wallet.address,
        exchangeAddress: "0x2768f1543ec9145cb680fc9699672c1a3226346d",
        makeFee: 0,
        takeFee: 0,
        side: ["BUY", "SELL"][ind],
        baseTokenAddress: tok.address,
        quoteTokenAddress: "0xa3f9eacdb960d33845a4b004974feb805e05c4a9"
      })
    })
  })

  return orders
}


const submitOrders = ords => {
  let news = ords.map( ord => client.new_order(ord)
//    .then( ord => `${ord.event.type} ${ord.event.payload.pairName}`)
    .catch( msg => {
      throw new Error(msg.toString())
    }) )

  return Promise.all(news)
}


export const populate = _ => {
  let allorders = client.pairs()
    .map( pair => getPricesForPair(pair)
     .then(cancelOrdersForPair)
     .then(prepOrdersForPair)
     .then(submitOrders)
     .catch(msg => {return {err: msg.toString(), pair: pair}}))

  return Promise.all(allorders)
}

