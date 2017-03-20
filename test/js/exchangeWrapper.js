// describe('batchFill', () => {
//   let orders;
//   beforeEach(done => {
//     Promise.all([
//       util.createOrder(orderFactory()),
//       util.createOrder(orderFactory()),
//       util.createOrder(orderFactory()),
//     ]).then(newOrders => {
//       orders = newOrders;
//       getDmyBalances().then(newBalances => {
//         balances = newBalances;
//         done();
//       });
//     });
//   });
//
//   it('should transfer the correct amounts', done => {
//     const fillValuesM = [];
//     const tokenM = dmyA.address;
//     const tokenT = dmyB.address;
//     orders.forEach(o => {
//       const fillValueM = div(o.valueM, 2);
//       const fillValueT = div(mul(fillValueM, o.valueT), o.valueM);
//       const feeValueM = div(mul(o.feeM, fillValueM), o.valueM);
//       const feeValueT = div(mul(o.feeT, fillValueM), o.valueM);
//       fillValuesM.push(fillValueM);
//       balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
//       balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
//       balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
//       balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
//       balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
//       balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
//       balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
//     });
//     exUtil.batchFill(orders, { fillValuesM, from: taker }).then(() => {
//       getDmyBalances().then(newBalances => {
//         assert(newBalances[maker][tokenM] === balances[maker][tokenM]);
//         assert(newBalances[maker][tokenT] === balances[maker][tokenT]);
//         assert(newBalances[maker][dmyPT.address] === balances[maker][dmyPT.address]);
//         assert(newBalances[taker][tokenT] === balances[taker][tokenT]);
//         assert(newBalances[taker][tokenM] === balances[taker][tokenM]);
//         assert(newBalances[taker][dmyPT.address] === balances[taker][dmyPT.address]);
//         assert(newBalances[feeRecipient][dmyPT.address] === balances[feeRecipient][dmyPT.address]);
//         done();
//       });
//     }).catch(e => {
//       assert(!e);
//       done();
//     });
//   });
//
//   it('should allow tokens acquired in trade to be used in later trade', done => {
//     dmyPT.setBalance(0, { from: taker }).then(() => {
//       balances[taker][dmyPT.address] = 0;
//       util.createOrder(orderFactory({ tokenM: dmyPT.address, feeT: 0 })).then(newOrder => {
//         orders[0] = newOrder;
//         const rest = orders.slice(1);
//         const fillValuesM = [0];
//         rest.forEach(o => {
//           fillValuesM[0] = add(fillValuesM[0], o.feeT);
//           fillValuesM.push(o.valueM);
//         });
//         orders.forEach((o, i) => {
//           const fillValueM = fillValuesM[i];
//           const fillValueT = div(mul(fillValueM, o.valueT), o.valueM);
//           const feeValueM = div(mul(o.feeM, fillValueM), o.valueM);
//           const feeValueT = div(mul(o.feeT, fillValueM), o.valueM);
//           balances[maker][o.tokenM] = sub(balances[maker][o.tokenM], fillValueM);
//           balances[maker][o.tokenT] = add(balances[maker][o.tokenT], fillValueT);
//           balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
//           balances[taker][o.tokenM] = add(balances[taker][o.tokenM], fillValueM);
//           balances[taker][o.tokenT] = sub(balances[taker][o.tokenT], fillValueT);
//           balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
//           balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
//         });
//         exUtil.batchFill(orders, { fillValuesM, from: taker }).then(() => {
//           getDmyBalances().then(newBalances => {
//             assert(newBalances[maker][dmyA.address] === balances[maker][dmyA.address]);
//             assert(newBalances[maker][dmyB.address] === balances[maker][dmyB.address]);
//             assert(newBalances[maker][dmyPT.address] === balances[maker][dmyPT.address]);
//             assert(newBalances[taker][dmyB.address] === balances[taker][dmyB.address]);
//             assert(newBalances[taker][dmyA.address] === balances[taker][dmyA.address]);
//             assert(newBalances[taker][dmyPT.address] === balances[taker][dmyPT.address]);
//             assert(newBalances[feeRecipient][dmyPT.address] === balances[feeRecipient][dmyPT.address]);
//             dmyPT.setBalance(INIT_BAL, { from: taker }).then(() => {
//               done();
//             });
//           });
//         }).catch(e => {
//           dmyPT.setBalance(INIT_BAL, { from: taker }).then(() => {
//             assert(!e);
//             done();
//           });
//         });
//       });
//     });
//   });
//
//   it('should cost less gas per order to execute batchFill', done => {
//     Promise.all(orders.map(o => exUtil.fill(o, { fillValueM: div(o.valueM, 2), from: taker }))).then(res => {
//       let totalGas = 0;
//       res.forEach(tx => {
//         totalGas = add(totalGas, tx.receipt.gasUsed);
//       });
//       exUtil.batchFill(orders, { fillValuesM: orders.map(o => div(o.valueM, 2)), from: taker }).then(innerRes => {
//         // console.log('fill:', totalGas);
//         // console.log('batchFill:', innerRes.receipt.gasUsed);
//         assert(cmp(innerRes.receipt.gasUsed, totalGas) === -1);
//         done();
//       }).catch(e => {
//         assert(!e);
//         done();
//       });
//     });
//   });
//
//   it('should log 2 events per order', done => {
//     exUtil.batchFill(orders, { fillValuesM: orders.map(o => div(o.valueM, 2)), from: taker }).then(res => {
//       assert(res.logs.length === orders.length * 2);
//       done();
//     }).catch(e => {
//       assert(!e);
//       done();
//     });
//   });
// });
