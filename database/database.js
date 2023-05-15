const fs = require('fs');

const filePath = './database/data.json';


function writeData(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readData() {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function addData(newData) {
  const data = readData();
  data.push(newData);
  writeData(data);
}

function findDataById(id) {
  const data = readData();
  return data.find((item) => item.id === id);
}

function deleteDataById(id) {
  const data = readData();
  const filteredData = data.filter((item) => item.id !== id);
  writeData(filteredData);
}

module.exports = {
  writeData,
  readData,
  addData,
  findDataById,
  deleteDataById
};
