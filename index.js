const express = require('express')
var multer = require('multer')
// const uuidv4 = require('uuid/v4')
const cors = require('cors')
const moment = require("moment")
const Stream = require("node-rtsp-stream");
const jwt = require('jsonwebtoken')
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const {createPool} = require('mysql')

const app = express()
app.use(cors())
app.use(express.static('public'))
app.use(
    express.urlencoded({
      extended: true
    })
  )
app.use(express.json())

// Database Config

let db = null

const initializeDBAndServer = () => {
    try {
      db = createPool({
        host: "sql948.main-hosting.eu",
        user: "u121649766_fstpuser",
        password: "Im@fstpuser1",
        database: 'u121649766_dashboard',
      })
    } catch (e) {
      console.log(`DB Error: ${e.message}`);
      process.exit(1);
    }
};
  
initializeDBAndServer();

// Image Config

var imgconfig = multer.diskStorage({
    destination:(req,file,callback)=>{
        callback(null,"public/images");
    },
    filename:(req,file,callback)=>{
        callback(null,`image-${Date.now()}.${file.originalname}`)
    }
});


// img filter
const isImage = (req,file,callback)=>{
    if(file.mimetype.startsWith("image")){
        callback(null,true)
    }else{
        callback(null,Error("only image is allowd"))
    }
}

var upload = multer({
    storage:imgconfig,
    fileFilter:isImage
})

// Serialport Config

const port = new SerialPort({
    path: 'COM6', //EDIT AS NEEDED
    baudRate: 9600 //EDIT AS NEEDED
})

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

var queue = [];
parser.on('data', function(data) {
  // push new data onto end of queue (array)
  queue.push(data);
});

port.on('close', function (msg) {
  console.log('1');
  queue.push(0)
})

// Rest API's 

app.get('/images/:plantId/', function(req, res, next) {
    const {plantId} = req.params
    console.log(req.params)
    const squery = `SELECT * FROM plant_details WHERE plantId = '${plantId}'`
    db.query(squery, (err, data) => {
        if(err) return res.json(err)
        return res.json(data)
    })
});

app.get('/plants/:phase/', function(req, res, next) {
    const {phase} = req.params
    console.log(req.params)
    const squery = `SELECT * FROM total_plant_details WHERE phase = '${phase}'`
    db.query(squery, (err, data) => {
        if(err) return res.json(err)
        return res.json(data)
    })
});

app.get('/getCities', function(req, res, next) {
    const squery = `SELECT City FROM District_Plants`
    db.query(squery, (err, data) => {
        if(err) return res.json(err)
        return res.json(data)
    })
});

app.get('/getColumns', function(req, res, next) {
    const squery = `show columns from District_Plants`
    db.query(squery, (err, data) => {
        if(err) return res.json(err)
        return res.json(data)
    })
});


// register userdata
app.post("/uploadimage",upload.single("image"),(req,res)=>{
    console.log(req.body)
    const {plantId} = req.body;
    const {filename} = req.file;

  
    if(!plantId || !filename){
        res.status(422).json({status:422,message:"fill all the details"})
    }
    
    try {
        
        let date = moment(new Date()).format("YYYY-MM-DD hh:mm:ss");
        
        db.query("INSERT INTO plant_details SET ?",{plantId:plantId,image:filename,date:date},(err,result)=>{
            if(err){
                console.log("error")
            }else{
                console.log(result)
                res.status(201).json({status:201,data:req.body})
            }
        })
    } catch (error) {
        res.status(422).json({status:422,error})
    }
});


// get user data
app.get("/getdata",(req,res)=>{
    try {
        db.query("SELECT * FROM plant_details",(err,result)=>{
            if(err){
                console.log("error")
            }else{
                console.log("data get")
                res.status(201).json({status:201,data:result})
            }
        })
    } catch (error) {
        res.status(422).json({status:422,error})
    }
});

app.post("/login", async (req, response) => {
    const {username, password} = req.body.body
    const getPasswordQuery = `SELECT password from user_details WHERE username = '${username}'`
    db.query(getPasswordQuery, (err, result) => {
        const dbUser = result[0]
        if(err){
            console.log("error", err)
            response.send("error: ", err)
        }else{
            if(dbUser === undefined){
                console.log("invalid user")
                response.send("Invalid User")
            }else{
                console.log(dbUser)
                if(password === dbUser.password){
                    const payload = {
                        username: username,
                      };
                    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
                    console.log(jwtToken)
                    response.send({ jwtToken });
                }else{
                    console.log("invalid pass")
                    response.send("Invalid Password")
                }
            }
        }
    })
})

app.get('/getweight', function(req, res) {
    if (req.params.getFullQueue === 1) {
      // empty complete contents of current queue,
      // sent to client as an array of { weight: x } objects
      const data = queue.splice(0, queue.length)
        .map(x => ({ weight: x }));
      console.log(data)
      res.send(data);
    } else {
      // get oldest enqueued item, send it only
      res.send({ weight: queue.shift() });
    }
  });

stream = new Stream({
  name: "Bunny",
  // streamUrl: "rtsp://YOUR_IP:PORT",
  streamUrl: "rtsp://admin:Admin@123@192.168.29.13:554/Streaming/Channels/101/",
  wsPort: 6789,  
  ffmpegOptions: { // options ffmpeg flags
    "-f": "mpegts", // output file format.
    "-codec:v": "mpeg1video", // video codec
    "-b:v": "1000k", // video bit rate
    "-stats": "",
    "-r": 25, // frame rate
    "-s": "640x480", // video size
    "-bf": 0,
    // audio
    "-codec:a": "mp2", // audio codec
    "-ar": 44100, // sampling rate (in Hz)(in Hz)
    "-ac": 1, // number of audio channels
    "-b:a": "128k", // audio bit rate
  },
});

app.listen(9000, () => {
    console.log("Server Running at http://localhost:9000/");
  });

module.exports = app