const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });


app.get('/api/data', async (req, res) => {
    const apiUrlString = req.query.apiUrlString.split('|');
    const exchangeAndURL = [];

    apiUrlString.map(singleUrl => {
        const splitted = singleUrl.split('>');
        const exchange = splitted[0];
        const url = splitted[1];
        exchangeAndURL.push({ exchange, url });
    });

    try {
        const responseArr = await Promise.all(
            exchangeAndURL.map(({ exchange, url }) => {
            return axios.get(url).then((response) => {
              return { exchange, data: response.data };
            });
          })
        );
        res.json(responseArr);
      } catch (error) {
        console.error(error);
        res.sendStatus(500);
      }
     

});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});