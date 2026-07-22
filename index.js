const express = require('express')
const crypto = require("crypto")
const app = express()
app.use(express.json())
const port = 8000.
const dns = require("dns")
require('dotenv').config()
const cors = require("cors")
app.use(cors())
dns.setServers(["8.8.8.8", "1.1.1.1"])
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.get('/', (req, res) => {
    console.log("env:", process.env.MONGODB_USER)
    res.send('Hello World!', process.env.MONGODB_PASS);
});

const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@cluster0.7hhwads.mongodb.net/?appName=Cluster0`;
// const uri = 'mongodb+srv://cloth-e-commerce:jyidBKCgiEWTULYX@cluster0.7hhwads.mongodb.net/?appName=Cluster0'

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const getProductId = () => {
    return "PRD-" + crypto.randomBytes(6).toString("base64url").replaceAll("_", "").replaceAll("-", "").slice(0, 6).toUpperCase()
}
console.log(getProductId())

async function run() {
    try {

        const db = client.db("Cloth_E_Commerce")
        const categoriesCollection = db.collection("Categories")
        const productsCollection = db.collection("Products")
        await productsCollection.createIndex({ productId: 1 }, { unique: true })

        // category-----------------------------------------------------------------------------------------------

        app.get("/categories", async (req, res) => {

            const result = await categoriesCollection.find().toArray()

            res.send(result)
        })

        app.patch("/category", async (req, res) => {
            const { id, isActive } = req.body
            // console.log(id, isActive)
            const query = { _id: new ObjectId(id) }
            let update = {}

            if (isActive.toString()) {
                update = { $set: { isActive: isActive, updatedAt: new Date() } }
            }
            // console.log("hello:------------",update)
            const result = await categoriesCollection.updateOne(query, update)
            res.send(result)
        })

        app.post("/category", async (req, res) => {
            const data = req.body
            data.isActive = true
            data.createdAt = new Date()
            data.updatedAt = new Date()
            const result = await categoriesCollection.insertOne(data)
            res.send(result)
        })

        app.delete("/category/:id", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const result = await categoriesCollection.deleteOne(query)
            res.send(result)
        })
        // category special 

        app.get("/categoryNames", async (req, res) => {
            const query = { isActive: true }
            const projection = {
                projection: {
                    _id: 1,
                    name: 1
                }
            }
            const namesInObject = await categoriesCollection.find(query, projection).toArray()
            res.send(namesInObject)
        })
        // products api _____________________________________________________________________________
        app.get("/products", async (req, res) => {

            const namesInObject = await productsCollection.find().toArray()
            res.send(namesInObject)
        })

        app.post("/product", async (req, res) => {
            const data = req.body
            data.createdAt = new Date()
            data.updatedAt = new Date()
            while (true) try {
                data.productId = getProductId()
                const variants = data.variants.map((item) => {
                    return { ...item, sku: data.productId + item.size + item.color.split("").slice(0, 3).join("").toUpperCase() }
                })
                data.variants = variants
                const result = await productsCollection.insertOne(data)
                return res.send(result)
            } catch (error) {
                console.log(error.code)
                if (error.code === 11000) {
                    continue
                }
                return res.send(error)
            }
        })
    } finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});