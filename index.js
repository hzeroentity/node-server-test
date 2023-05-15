const express = require('express');
const axios = require('axios');
const app = express();
const { Telegraf } = require('telegraf')
const cron = require('node-cron');
const port = process.env.PORT || 3000;

// Tokens List [[ID, Name, Address].[].[]...]
// IMPORTANT:  dexes MUST be put as last on the array, price check will be valued only if there's already a set price to compare
const _tokens = [
  ['ODOGE', 'Optimism Doge', '0x9528b1166381fe60f24a952315a3e528a56407a0', ['cointiger', 'pancakeswap'], '10'],
  ['OGGY', 'Oggy Inu', '0x92ed61fb8955cc4e392781cb8b7cd04aadc43d0c', ['cointiger', 'pancakeswap'], '10'],
  //['PIG', 'Pig Finance', '0x8850d2c68c632e3b258e612abaa8fada7e6958e5', [ 'gate', 'pancakeswap'], '5'], 
  ['BABYDOGE', 'Baby Doge Coin', '0xc748673057861a797275cd8a068abb95a902e8de', ['kucoin', 'gate', 'hotbit', 'bkex', 'pancakeswap'], '10'], 
  ['OPEPE', 'Optimism PEPE', '0x0851ad49cFf57C024594Da73095E6E05d8B1676a', ['cointiger', 'pancakeswap'], '10'],
  ['MAZI', 'MAziMatic', '0x5b8650cd999b23cf39ab12e3213fbc8709c7f5cb', ['bkex', 'pancakeswap'], '0'],
  ['SHIBCAT', 'Shibcat', '0xd5FF3786CE4a75156d27aB026eb04c9eD53b365f', ['bkex', 'pancakeswap'], '10'],
  ['JADE', 'Jade Protocol', '0x7ad7242a99f21aa543f9650a56d141c57e4f6081', ['bkex', 'pancakeswap'], '0'],
  ['FLOKICEO', 'Floki Ceo', '0x45289007706E7Ee7B42b1fA506661d97740Edfb4', ['gate', 'cointiger', 'pancakeswap'], '10'], // Lbank, Bitmart, , MEXC, 
  //['KABOSU', 'Kabosu', '0x4A824eE819955A7D769e03fe36f9E0C3Bd3Aa60b', ['probit',  'atoken', 'pancakeswap'], '10'],
  //['DOGGY', 'Doggy', '0x74926b3d118a63f6958922d3dc05eb9c6e6e00c6', ['gate', 'mexc', 'bakeryswap'], '0'],
  ['QUACK', 'RichQUACK', '0xD74b782E05AA25c50e7330Af541d46E18f36661C', ['gate', 'pancakeswap'], '12'], //latoken, mexc, bitmart
  ['YOOSHI', 'YOOSHI', '0x02ff5065692783374947393723dba9599e59f591', ['gate',  'bkex', 'cointiger', 'pancakeswap'], '10'], //mexc, bitmart
  // Add new tokens HERE
];

// DA FARE aggiungere exchange: bybit, bitstamp, bithumb, lbank, houbi, mexc, bitmart, probit, bitrue, indoex?, xtcom
// aggiungere checl deposit/withdraw 

const BABYDOGE = "0xc748673057861a797275CD8A068AbB95A902e8de";
const Symbol = "BABYDOGE"

// API URLs for tokens info in exchanges 
const _dexScreenerURL = 'https://api.dexscreener.com/latest/dex/tokens/'; // + symbol
const _kucoinTickerURL = 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol='; // + pair [BABYDOGE-USDT]
const _bkexTickerURL = 'https://api.bkex.com/v2/q/ticker/price?symbol='; // + pair [BABYDOGE_USDT]
const _gateTickerURL = 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair='; // + pair [BABYDOGE_USDT]

// API URLs Dividers
const _kucoinPairDivider = '-';
const _bkexPairDivider = '_';
const _gatePairDivider = '_';

// API URLs for exchange's OrderBooks
const _kucoinOrderBookURL = 'https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol='; // + pair
const _bkexOrderBookURL = `https://api.bkex.com/v2/q/depth?symbol=`; // + pair
const _bkexOrderBookParameter = '&depth='; //number of digits to display. Must match to coin price depth
const _gateOrderBookURL = 'https://api.gateio.ws/api/v4/spot/order_book?currency_pair='; // + pair
const _cointigerOrderBookURL = 'https://api.cointiger.com/exchange/trading/api/market/depth?api_key=100310001&symbol='; //piar lowercase no divider [pigusdt] for PIG-USDT
const _cointigerOrderBookParameter = '&type=step0';

// API URLs for deposit and withdraw availability
const _gateDWStatus = 'https://api.gateio.ws/api/v4/wallet/currency_chains?currency='; // + currency ID ex. USDT


// Other manually inserted values
const _minimumVolumeOrderBook = 5; //usd

let currentData = [];

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
            res.json(currentData[index]);
        } else {
            res.json(currentData);
        }
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

 
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});


async function main() {
    
    const exchangeAndURL = [];
    
    _tokens.forEach(token => {

      // Prepare URLs befor API calls
      token[3].forEach(exchange => {
  
        switch(exchange) {
            case 'kucoin':
              tokenInfo = token[0] + '|' + token[1] + '|' + token[4];
              url = toFetchURL = _kucoinOrderBookURL + token[0] + _kucoinPairDivider + 'USDT';
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'bkex':
              tokenInfo = token[0] + '|' + token[1] + '|' + token[4];
              if (token[0]=='SQUIDGROW') {
                url = _bkexOrderBookURL + 'SquidGrow' + _bkexPairDivider + 'USDT' + _bkexOrderBookParameter + '20';
              } else {
                url = _bkexOrderBookURL + token[0] + _bkexPairDivider + 'USDT' + _bkexOrderBookParameter + '20';
              }
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'gate':
              tokenInfo = token[0] + '|' + token[1] + '|' + token[4];
                url = _gateOrderBookURL + token[0] + _gatePairDivider + 'USDT';
                exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'cointiger':
              tokenInfo = token[0] + '|' + token[1] + '|' + token[4];
              url = _cointigerOrderBookURL + token[0].toLowerCase() + 'usdt' + _cointigerOrderBookParameter;
              exchangeAndURL.push({ tokenInfo, exchange, url });
            break;
            case 'pancakeswap':
              tokenInfo = token[0] + '|' + token[1] + '|' + token[4];
              url = _dexScreenerURL + token[2];
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

          

          token.exchanges.forEach(res => {

            let exchangeData = res.data;
              
              switch(res.exchange) {
                  case 'kucoin':

                      buyPrice = null; 
                      sellPrice = null;

                      found = false;
                      exchangeData.data.bids.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              buyPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });

                      found = false;
                      exchangeData.data.asks.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              sellPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });
                      exchangeAndPrice.push(['kucoin', buyPrice, sellPrice]);
                      break;
                  case 'bkex':
                      //currentPrice = negativePowerResolver(exchangeData.data[0].price);
                      buyPrice = null; 
                      sellPrice = null;

                      found = false;
                      exchangeData.data.bid.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              buyPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });

                      found = false;
                      exchangeData.data.ask.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              sellPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });
                      exchangeAndPrice.push(['bkex', buyPrice, sellPrice]);            
                      break;
                  case 'gate':
                      buyPrice = null; 
                      sellPrice = null;

                      found = false;
                      exchangeData.bids.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              buyPrice = negativePowerResolver(order[0]  + (order[0] / 100 * token.tokenBurn));
                              found = true;
                          }
                      });

                      found = false;
                      exchangeData.asks.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              sellPrice = negativePowerResolver(order[0] - (order[0] / 100 * token.tokenBurn));
                              found = true;
                          }
                      });
                      exchangeAndPrice.push(['gate', buyPrice, sellPrice]);
                      break;            
                  case 'cointiger':
                      buyPrice = null; 
                      sellPrice = null;

                      found = false;
                      exchangeData.data.depth_data.tick.buys.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              buyPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });

                      found = false;
                      exchangeData.data.depth_data.tick.asks.forEach(order => {
                          if(order[1] * order[0] > _minimumVolumeOrderBook && found == false) {
                              sellPrice = negativePowerResolver(order[0]);
                              found = true;
                          }
                      });

                      exchangeAndPrice.push(['cointiger', buyPrice, sellPrice]);                 
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
                  
                  break;
              } 

              let lowestSell = ['',''];
              let highestBuy = ['',''];
              let first = true;

              // find cexes highest ask and lowest bid
              exchangeAndPrice.forEach(line => {
                  if(first) {
                      highestBuy[0] = line[0]
                      highestBuy[1] = line[1];
                      
                      lowestSell[0] = line[0];
                      lowestSell[1] = line[2];
                      first = false;
                  } else {
                      if(line[1] > highestBuy[1]) {
                          highestBuy[0] = line[0];
                          highestBuy[1] = line[1];
                      }
                      if(line[2] < lowestSell[1]) {
                          lowestSell[0] = line[0];
                          lowestSell[1] = line[2];
                      }
                  }
              }); 

              //check pancake prices
              // TO DO add control to figure if the 10% penalty having pancake in buy or sell makes it still the best choice
              if(pancakePriceCheck.firstLoop == false) {

                  // check if pancake itself has higher discrepancy than Cex
                  if (pancakePriceCheck.highPrice > highestBuy[1] && pancakePriceCheck.lowPrice < lowestSell[1]) {
                      highestBuy[0] = pancakePriceCheck.highPair;
                      highestBuy[1] = pancakePriceCheck.highPrice;

                      lowestSell[0] = pancakePriceCheck.lowPair;
                      lowestSell[1] = pancakePriceCheck.lowPrice;
                  } else { //otherwise check with cexes 
                      if (pancakePriceCheck.highPrice > highestBuy[1]) {
                          highestBuy[0] = pancakePriceCheck.highPair;
                          highestBuy[1] = pancakePriceCheck.highPrice;
                      }

                      if (pancakePriceCheck.highPrice < lowestSell[1]) {
                          lowestSell[0] = pancakePriceCheck.lowPair;
                          lowestSell[1] = pancakePriceCheck.lowPrice;
                      }
                  }
              }

              if(index == token.exchanges.length - 1) {

                retrieveTokenInfo = token.tokenInfo.split('|');

                const tokenId = retrieveTokenInfo[0];
                const tokenName = retrieveTokenInfo[1];
                const tokenBurn = retrieveTokenInfo[2];

                // calculate gain (must be moved in the data calculation before to take tokenBurn in account)
                let increase = highestBuy[1] - lowestSell[1];
                let percentageIncrease = increase / lowestSell[1] * 100;

                
                let gain = 0;

                // if the trade is cex -> cex apply burn only once
                // if the trade is dex -> cex / cex -> dex apply burn twice
                if (tokenBurn > 0) {
                    if (highestBuy[0].includes('/') || lowestSell[0].includes('/')) { //if it contains '/' it means that it is a pancake pair
                        gain = (Math.round(percentageIncrease * 100) / 100  - (tokenBurn * 2)).toFixed(2);
                    } else {
                        gain = (Math.round(percentageIncrease * 100) / 100 - (tokenBurn)).toFixed(2) ;
                    }
                } else {
                    gain = percentageIncrease.toFixed(2);
                }

                //Send Telegram Bot notification if gain > 25%
                if (gain >= 5 && gain < 10) {
                    bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💵 Good gain del ${gain}% su ${tokenName}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${tokenId}`);
                } else if (gain >= 10 && gain < 20) {
                    bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `💰 Solid gain del ${gain}% su ${tokenName}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${tokenId}`);
                } else if (gain >= 20) {
                    bot.telegram.sendMessage(process.env.TELEGRAM_GROUPCHAT_ID, `🔥 SUPER gain del ${gain}% su ${tokenName}! Vedi: miralmedia.it/tools/arbitrix/details.html?token=${tokenId}`);
                }

                readyForDOM.push({ tokenId, tokenName, tokenBurn, lowestSell, highestBuy, gain });
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

cron.schedule('*/2 * * * *', main);


function negativePowerResolver(number) {
    //2.392e-9
    //Number() up to the power of 6
    try {

        if(number.toString().includes('e-')) {
            let splitNumber = number.toString().split('e-');

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