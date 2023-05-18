const express = require('express');
const axios = require('axios');
const app = express();
const { Telegraf } = require('telegraf')
const cron = require('node-cron');
const db = require('./database/database');
const port = process.env.PORT || 3000;

// API URLs for tokens info in exchanges 
const _dexScreenerURL = 'https://api.dexscreener.com/latest/dex/tokens/'; // + symbol
const _kucoinTickerURL = 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol='; // + pair [BABYDOGE-USDT]
const _bkexTickerURL = 'https://api.bkex.com/v2/q/ticker/price?symbol='; // + pair [BABYDOGE_USDT]
const _gateTickerURL = 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair='; // + pair [BABYDOGE_USDT]

// API URLs Dividers
const _kucoinPairDivider = '-';
const _bkexPairDivider = '_';
const _gatePairDivider = '_';
const _bitmartPairDivider = '_';

// API URLs for exchange's OrderBooks
const _kucoinOrderBookURL = 'https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol='; // + pair
const _bkexOrderBookURL = `https://api.bkex.com/v2/q/depth?symbol=`; // + pair
const _bkexOrderBookParameter = '&depth='; //number of digits to display. Must match to coin price depth
const _gateOrderBookURL = 'https://api.gateio.ws/api/v4/spot/order_book?currency_pair='; // + pair
const _cointigerOrderBookURL = 'https://api.cointiger.com/exchange/trading/api/market/depth?api_key=100310001&symbol='; //piar lowercase no divider [pigusdt] for PIG-USDT
const _cointigerOrderBookParameter = '&type=step0';
const _mexcOrderBookURL = 'https://api.mexc.com/api/v3/depth?symbol='; // FLOKICEOUSDT
const _latokenOrderBookURL = 'https://api.latoken.com/v2/book/'; //QUACK/USDT
const _bitmartOrderBookURL = 'https://api-cloud.bitmart.com/spot/v1/symbols/book?symbol='; //BMX_ETH

// API URLs for deposit and withdraw availability
const _gateDWStatus = 'https://api.gateio.ws/api/v4/wallet/currency_chains?currency='; // + currency ID ex. USDT


// Other manually inserted values
const _minimumVolumeOrderBook = 10; //usd

let currentData = [];
let activeAlerts = [];

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


app.get('/api/data', async (req, res) => {

    const tokenId = req.query.parameter;
    
    try {

        if(tokenId != '') {
            const index = currentData.findIndex(item => item.tokenId === tokenId)
            const tokenAddress = getTokens(tokenId).address;
            const dataAndAdrress = [currentData[index], tokenAddress] 

            res.json(dataAndAdrress);
        } else {
            res.json(currentData);
        }
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }

});

app.get('/api/tokens', async (req, res) => {

    const tokenId = req.query.parameter;

    try {

        if(tokenId != '') {
            res.json(getTokens(tokenId));
        } else {
            res.json(getTokens(''));
        }
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/api/tokens/delete', async (req, res) => {

    const tokenId = req.query.parameter;

    try {

        if(tokenId != '') {
            deleteToken(tokenId);
        }
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});


/*app.get('/api/tokens/udate', async (req, res) => {

    const tokenId = req.query.parameter;

    try {

        if(tokenId != '') {
            updateToken(tokenId);
        }
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});*/


app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});



function getTokens(id) {

    const tokens = db.readData();

    if (id != '') {
        return tokens.find(item => item.id === id);
    } else {
        return tokens;
    }
}

function deleteToken(id) {

    if (id != '') {
        db.deleteDataById(id);
    } else {
    }
}

/*function updateToken(id, name, address, exchanges, burn) {

    if (id != '') {
        db.updateDataById(id, name, address, exchanges, burn);
    } else {
    }
}*/



async function main() {
    
    const exchangeAndURL = [];

    const tokenList = db.readData()
    
    tokenList.forEach(token => {

      // Prepare URLs befor API calls
      token.exchanges.forEach(exchange => {
  
        switch(exchange) {
            case 'kucoin':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = toFetchURL = _kucoinOrderBookURL + token.id + _kucoinPairDivider + 'USDT';
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'bkex':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              if (token.id == 'ODOGE') {
                url = _bkexOrderBookURL + 'OPTIMISMDOGE' + _bkexPairDivider + 'USDT' + _bkexOrderBookParameter + '20';
              } else {
                url = _bkexOrderBookURL + token.id + _bkexPairDivider + 'USDT' + _bkexOrderBookParameter + '20';
              }
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'cointiger':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = _cointigerOrderBookURL + token.id.toLowerCase() + 'usdt' + _cointigerOrderBookParameter;
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'mexc':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = _mexcOrderBookURL + token.id + 'USDT';
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'latoken':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = _latokenOrderBookURL + token.id + '/USDT';
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'bitmart':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = _bitmartOrderBookURL + token.id + _bitmartPairDivider + 'USDT';
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'pancakeswap':
              tokenInfo = token.id + '|' + token.name + '|' + token.burn;
              url = _dexScreenerURL + token.address;
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
          } 
      }); 
  
    });

    const unorderedData = [];
    const readyForDOM = [];

    try {
        await Promise.all(
            exchangeAndURL.map(({ tokenInfo, exchange, url }) => {
            return axios.get(url).then((response) => {
              unorderedData.push({ tokenInfo, exchange, data: response.data });
            });
          })
        );

        const groupedData = unorderedData.reduce((acc, obj) => {
          const { tokenInfo, exchange, data } = obj;
          if (!acc[tokenInfo]) {
            acc[tokenInfo] = { [exchange]: data };
          } else if (!acc[tokenInfo][exchange]) {
            acc[tokenInfo][exchange] = data;
          }
          return acc;
        }, {});
        
        const orderedData = Object.entries(groupedData).map(([tokenInfo, exchanges]) => ({
          tokenInfo,
          exchanges: Object.entries(exchanges).map(([exchange, data]) => ({ exchange, data })),
        }));
        
        orderedData.forEach(token => {

          const exchangeAndPrice = [];
          let index = 0;
          let pancakePriceCheck = { lowPrice: '', lowPair: '', highPrice: '', highPair: '', firstLoop: true}; //['', '', '', '', false];  // 0 lowest price, 1 low pair, 2 highest price, 3 high pair, 4 first set done

          let found = false;

          
          //ASK = RED
          //BID = GREEN

          token.exchanges.forEach(res => {

            let exchangeData = res.data;
              
              switch(res.exchange) {
                  case 'kucoin':
                    greenPrice = null; 
                    redPrice = null;
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                    found = false;
                    exchangeData.data.bids.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(order[0]);
                            greenAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });

                    found = false;
                    exchangeData.data.asks.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(order[0]);
                            redAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });
                    exchangeAndPrice.push(['kucoin', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);
                    break;
                  case 'bkex':
                    greenPrice = null;    
                    redPrice = null; 
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                      found = false;
                      exchangeData.data.bid.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(order[0]);
                            greenAvailableLiquidity = order[1] * order[0];
                              found = true;
                          }
                      });

                      found = false;
                      exchangeData.data.ask.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(order[0]);
                            redAvailableLiquidity = order[1] * order[0];
                              found = true;
                          }
                      });

                      exchangeAndPrice.push(['bkex', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);            
                      break;
                  case 'cointiger':
                    greenPrice = null; 
                    redPrice= null;
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                    found = false;
                    exchangeData.data.depth_data.tick.buys.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(order[0]);
                            greenAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });

                    found = false;
                    exchangeData.data.depth_data.tick.asks.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(order[0]);
                            redAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });

                    exchangeAndPrice.push(['cointiger', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);                 
                    break;
                  case 'mexc':
                    greenPrice = null; 
                    redPrice = null;
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                    found = false;
                    exchangeData.bids.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(order[0]);
                            greenAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });

                    found = false;
                    exchangeData.asks.forEach(order => {
                        if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(order[0]);
                            redAvailableLiquidity = order[1] * order[0];
                            found = true;
                        }
                    });
                    exchangeAndPrice.push(['mexc', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);            
                    break;
                  case 'latoken':
                    greenPrice = null; 
                    redPrice = null;
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                    found = false;

                    exchangeData.bid.map(order => {
                        if(order.price * order.quantity > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(order.price);
                            greenAvailableLiquidity = order.price * order.quantity;
                            found = true;
                        }
                    });

                    found = false;
                    exchangeData.ask.map(order => {
                        if(order.price * order.quantity> _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(order.price);
                            redAvailableLiquidity = order.price * order.quantity;
                            found = true;
                        }
                    });
                    
                    exchangeAndPrice.push(['latoken', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);            
                    break;
                  case 'bitmart':
                    greenPrice = null; 
                    redPrice = null;
                    greenAvailableLiquidity = null;
                    redAvailableLiquidity = null;

                    found = false;

                    exchangeData.data.buys.map(order => {
                        const bitmartPrice = negativePowerResolver(order.price)
                        if(bitmartPrice * order.amount > _minimumVolumeOrderBook && found == false) {
                            greenPrice = negativePowerResolver(bitmartPrice);
                            greenAvailableLiquidity = bitmartPrice * order.amount;
                            found = true;
                        }
                    });

                    found = false;
                    exchangeData.data.sells.map(order => {
                        const bitmartPrice = negativePowerResolver(order.price)
                        if(bitmartPrice * order.amount > _minimumVolumeOrderBook && found == false) {
                            redPrice = negativePowerResolver(bitmartPrice);
                            redAvailableLiquidity = bitmartPrice * order.amount;
                            found = true;
                        }
                    });
                    
                    exchangeAndPrice.push(['bitmart', redPrice, greenPrice, redAvailableLiquidity, greenAvailableLiquidity]);            
                    break;
                  case 'pancakeswap':

                      const dexPairs = exchangeData.pairs;
                      dexPairs.forEach(singlePair => {
                          if (singlePair.dexId == 'pancakeswap') {
                              if (singlePair.liquidity.usd >= 2500) {

                                  if (pancakePriceCheck.firstLoop) {
                                      pancakePriceCheck.lowPrice = singlePair.priceUsd;
                                      pancakePriceCheck.lowPair = singlePair.baseToken.symbol + '/' + singlePair.quoteToken.symbol;
                                      pancakePriceCheck.highPrice = singlePair.priceUsd;
                                      pancakePriceCheck.highPair = singlePair.baseToken.symbol + '/' + singlePair.quoteToken.symbol;
                                      pancakePriceCheck.firstLoop = false;
                                  } else {

                                      if(singlePair.priceUsd < pancakePriceCheck.lowPrice) {
                                          pancakePriceCheck.lowPrice = singlePair.priceUsd;
                                          pancakePriceCheck.lowPair = singlePair.baseToken.symbol + '/' + singlePair.quoteToken.symbol;
                                      }

                                      if(singlePair.priceUsd > pancakePriceCheck.highPrice) {
                                          pancakePriceCheck.highPrice = singlePair.priceUsd;
                                          pancakePriceCheck.highPair = singlePair.baseToken.symbol + '/' + singlePair.quoteToken.symbol;
                                      }

                                  }
                              }
                          }
                      });


                      // checks how many decimals the price has
                      pancakePriceCheck.lowPrice = negativePowerResolver(pancakePriceCheck.lowPrice);
                      pancakePriceCheck.highPrice = negativePowerResolver(pancakePriceCheck.highPrice);
                      
                      const lowDecimals = decimalsCounter(pancakePriceCheck.lowPrice);
                      const highDecimals = decimalsCounter(pancakePriceCheck.highPrice);

                      // Add and remove 1% of the price to take swap fees in account
                      pancakePriceCheck.lowPrice = (pancakePriceCheck.lowPrice * 1.01).toFixed(lowDecimals);
                      pancakePriceCheck.highPrice = (pancakePriceCheck.highPrice * 0.99).toFixed(highDecimals);
                  
                  break;
              }               

              let highestGreen = ['','',''];
              let lowestRed = ['','',''];
              
              let first = true;

              // find cexes highest ask and lowest bid
              exchangeAndPrice.forEach(line => {
                  if(first) {
                    lowestRed[0] = line[0];
                    lowestRed[1] = line[1];
                    lowestRed[2] = line[3];
                    
                    highestGreen[0] = line[0];
                    highestGreen[1] = line[2];
                    highestGreen[2] = line[4];
                    first = false;
                  } else {
                      if(line[1] < lowestRed[1]) {
                        lowestRed[0] = line[0];
                        lowestRed[1] = line[1];
                        lowestRed[2] = line[3];
                      }
                      if(line[2] > highestGreen[1]) {
                        highestGreen[0] = line[0];
                        highestGreen[1] = line[2];
                        highestGreen[2] = line[4];
                      }
                  }
              }); 

              //check pancake prices
              // TO DO add control to figure if the 10% penalty having pancake in buy or sell makes it still the best choice
              if(pancakePriceCheck.firstLoop == false) {

                  // check if pancake itself has higher discrepancy than Cex
                  if (pancakePriceCheck.highPrice > highestGreen[1] && pancakePriceCheck.lowPrice < lowestRed[1]) {
                      highestGreen[0] = pancakePriceCheck.highPair;
                      highestGreen[1] = pancakePriceCheck.highPrice;
                      highestGreen[2] = null;

                      lowestRed[0] = pancakePriceCheck.lowPair;
                      lowestRed[1] = pancakePriceCheck.lowPrice;
                      lowestRed[2] = null;
                  } else { //otherwise check with cexes 
                      if (pancakePriceCheck.highPrice > highestGreen[1]) {
                          highestGreen[0] = pancakePriceCheck.highPair;
                          highestGreen[1] = pancakePriceCheck.highPrice;
                          highestGreen[2] = null;
                      }

                      if (pancakePriceCheck.highPrice < lowestRed[1]) {
                        lowestRed[0] = pancakePriceCheck.lowPair;
                        lowestRed[1] = pancakePriceCheck.lowPrice;
                        lowestRed[2] = null;
                      }
                  }
              }

              if(index == token.exchanges.length - 1) {

                retrieveTokenInfo = token.tokenInfo.split('|');

                const tokenId = retrieveTokenInfo[0];
                const tokenName = retrieveTokenInfo[1];
                const tokenBurn = retrieveTokenInfo[2];

                // calculate gain (must be moved in the data calculation before to take tokenBurn in account)
                let increase = highestGreen[1] - lowestRed[1];
                let percentageIncrease = increase / lowestRed[1] * 100;

                
                let gain = 0;

                // if the trade is cex -> cex apply burn only once
                // if the trade is dex -> cex / cex -> dex apply burn twice
                if (tokenBurn > 0) {
                    if (highestGreen[0].includes('/') || lowestRed[0].includes('/')) { //if it contains '/' it means that it is a pancake pair
                        gain = (Math.round(percentageIncrease * 100) / 100  - (tokenBurn * 2)).toFixed(2);
                    } else {
                        gain = (Math.round(percentageIncrease * 100) / 100 - (tokenBurn)).toFixed(2) ;
                    }
                } else {
                    gain = percentageIncrease.toFixed(2);
                }
                
                let lowBurn = false;
                let highBurn = false;

                
                // Send Alerts
                if (tokenBurn >= 8 && gain > 5) {
                    highBurn = true;
                } else if (tokenBurn < 8 && gain > 3) {
                    lowBurn = true;
                }


                if (lowBurn == true || highBurn == true) {
                    const checkExistingAlert = activeAlerts.find(item => item.id === tokenId);

                    if (checkExistingAlert) {
                        if (checkExistingAlert.gain + 1 < gain ) {
                            activeAlerts = updateAlertsGain(activeAlerts, tokenId, gain);
                            sendTelegramAlert(tokenId, tokenName, gain, tokenBurn);
                        } else {
                            if (tokenBurn >= 8) {
                                if (gain < 5) {
                                    activeAlerts = activeAlerts.filter(item => item.id == tokenId);
                                }
                            } else {
                                if (gain < 3) {
                                    activeAlerts = activeAlerts.filter(item => item.id == tokenId);
                                }
                            }
                        }
                    } else {
                        activeAlerts.push({ id: tokenId, name: tokenName, gain: gain });
                        sendTelegramAlert(tokenId, tokenName, gain, tokenBurn);
                    }
                }

                readyForDOM.push({ tokenId, tokenName, tokenBurn, lowestRed, highestGreen, gain});
              }

              index++; 
          
          })
        });

        readyForDOM.sort((a, b) => b.gain - a.gain);
        currentData = readyForDOM;

      } catch (error) {
        console.error(error);
      }
}

cron.schedule('*/1 * * * *', main);

function sendTelegramAlert(id, name, gain, burn) {


    // Send Telegram Bot notifications
    if (burn >= 8) {
        if (gain >= 5 && gain < 10) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💵 Good gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        } else if (gain >= 10 && gain < 20) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💰 Solid gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        } else if (gain >= 20) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `🔥 SUPER gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        }
    } else {
        if (gain >= 3 && gain < 5) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💵 Good gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        } else if (gain >= 5 && gain < 9) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💰 Solid gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        } else if (gain >= 9) {
            bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `🔥 SUPER gain del ${gain}% su ${name}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${id}`);
        }
    }
}

function updateAlertsGain(alertsArray, id, newGain) {
    const updatedAlertsArray = alertsArray.map(item => {
      if (item.id == id) {
        return { ...item, gain: newGain }; // Update the gain value
      }
      return item;
    });
    return updatedAlertsArray;
  }


function negativePowerResolver(number) {
    //2.392e-9
    //Number() up to the power of 6
    try {

        if(number.toString().includes('e-') || number.toString().includes('E-')) {

            let splitNumber = number.toString().split('-');
            splitNumber[0] = splitNumber[0].slice(0, -1);

            if (splitNumber[1] > 6 ) {
    
                valuableDigits = splitNumber[0].replace('.','');
    
                let added = ''
                
                for(let i = 0; i < splitNumber[1] - 1; i++) {
                    added = added + '0';
                }

                return '0.' + added + valuableDigits;
            } else {
                return Number(number).toString();
            }   
        } else {
            return number.toString();
        }
        

    } catch(error) {
        console.log('ERROR IN NPR: ' + error);
    }

}


function decimalsCounter(number) {
    const numberString = number.toString();
    const decimalIndex = numberString.indexOf('.');
    
    if (decimalIndex === -1) {
      return 0; // No decimals
    } else {
      return numberString.length - decimalIndex - 1;
    }
  }