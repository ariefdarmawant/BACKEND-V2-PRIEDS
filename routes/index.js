var express = require("express");
var router = express.Router();
const stock_read_log = require("../models/stock_read_log");
const FileSystem = require("fs");

router.use("/export-data", async (req, res) => {
  const list = await stock_read_log
    .aggregate([
      {
        $match: {},
      },
    ])
    .exec();

  FileSystem.writeFile(
    "./stock_read_log.json",
    JSON.stringify(list),
    (error) => {
      if (error) throw error;
    }
  );

  console.log("stock_read_log.json exported!");
  res.json({ statusCode: 1, message: "stock_read_log.json exported!" });
});

router.use("/import-data", async (req, res) => {
  const list = await stock_read_log
    .aggregate([
      {
        $match: {},
      },
    ])
    .exec();

  FileSystem.readFile("./stock_read_log.json", async (error, data) => {
    if (error) throw error;

    const list = JSON.parse(data);

    const deletedAll = await stock_read_log.deleteMany({});

    const insertedAll = await stock_read_log.insertMany(list);

    console.log("stock_read_log.json imported!");
    res.json({ statusCode: 1, message: "stock_read_log.json imported!" });
  });
});

router.use("/edit-repacking-data", async (req, res) => {
  const rejectQRList = req.body.reject_qr_list || [];
  const newQRList = req.body.new_qr_list || [];
  const newQRListToBeUpdate = newQRList.map(value => value.payload);
  const stock = await stock_read_log.findOne({ payload: req.body.payload });
  let newQRListCurStock = [...stock.qr_list];
  //handle reject QR
  const rejectQRPayloadList = rejectQRList.map(value => value.payload);
  await Promise.all(rejectQRPayloadList.map(async (QR) => {
    //update payload on db
    await stock_read_log.updateOne(
      { payload: QR },
      { $set: { status: 0, status_qc: 1 } }
    );
  }));
  newQRListCurStock = newQRListCurStock.filter(({payload: oQR}) => !(rejectQRPayloadList.includes(oQR)));
  //handle new QR
  await Promise.all(newQRListToBeUpdate.map(async (QR) => {
    const stockContainingQR = await stock_read_log.findOne({"qr_list.payload": QR});
    let QRListAffected = stockContainingQR.qr_list;
    QRListAffected = QRListAffected.filter((elem) => {
      if(elem.payload===QR){
        newQRListCurStock.push(elem);
      }
      return elem.payload !== QR;
    })
    //update to DB with new QRList and new QTY
    await stock_read_log.updateOne({_id: stockContainingQR._id}, {$set: {qr_list: QRListAffected, qty: QRListAffected.length}})
  }))
  
  //update main payload
  const result = await stock_read_log.updateOne({_id: stock._id}, {$set: {qr_list: newQRListCurStock, qty: newQRListCurStock.length}})
  res.json({statusCode: 200, message: "Updated payload", data: result});
  // Silahkan dikerjakan disini.
});

router.use("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

module.exports = router;
