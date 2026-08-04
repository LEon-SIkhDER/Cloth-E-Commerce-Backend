const express = require('express')
const crypto = require("crypto")
const cloudinary = require('cloudinary').v2;
const cron = require('node-cron')
const app = express()
app.use(express.json())
const port = 8000.
const dns = require("dns")
require('dotenv').config()
const cors = require("cors")
app.use(cors())
dns.setServers(["8.8.8.8", "1.1.1.1"])
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
})

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
// return { ...item, sku: data.productId + item.size + item.color.split("").slice(0, 3).join("").toUpperCase() }

const getSku = (productId, productSize, productColor) => {
    return productId + productSize + productColor.split('').slice(0, 3).join("").toUpperCase()
}
console.log(getProductId())
console.log(getSku(getProductId(), "XL", "Purple"))


async function run() {
    try {

        const db = client.db("Cloth_E_Commerce")
        const categoriesCollection = db.collection("Categories")
        const productsCollection = db.collection("Products")
        const failedImagesDeletion = db.collection("FailedImagesDeletion")
        await productsCollection.createIndex({ productId: 1 }, { unique: true })


        // category-----------------------------------------------------------------------------------------------

        app.get("/category/:id", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const result = await categoriesCollection.findOne(query)
            res.send(result)
        })

        app.get("/categories", async (req, res) => {
            const result = await categoriesCollection.find().toArray()
            res.send(result)
        })

        app.patch("/category/status", async (req, res) => {
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

        app.patch("/category/:id", async (req, res) => {
            // console.log("working")
            const { id } = req.params
            const { formData, publicIdToDelete } = req.body

            const query = { _id: new ObjectId(id) }
            const update = { $set: formData }
            if (publicIdToDelete) {
                try {
                    await cloudinary.uploader.destroy(publicIdToDelete)
                } catch (error) {
                    const insert = {
                        publicId: publicIdToDelete,
                        attempt: 1,
                        firstAttempt: new Date(),
                        error
                    }
                    console.log(insert)
                    failedImagesDeletion.insertOne(insert)
                }
            }
            // console.log(query, update)

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
        app.get("/product/:id", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.findOne(query)
            res.send(result)
        })

        app.get("/products/:categoryId", async (req, res) => {
            const categoryId = req.params
            const result = await productsCollection.find(categoryId).toArray()
            res.send(result)
        })



        app.get("/products", async (req, res) => {
            const result = await productsCollection.find().toArray()
            res.send(result)
        })

        app.patch('/product/:id', async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const { formData: data, publicIdsToDelete } = req.body
            data.variants = data.variants.map(variant => {
                if (variant.sku.trim() === "") {
                    return { ...variant, sku: getSku(data.productId, variant.size, variant.color) }
                }
                return variant
            })
            data.updatedAt = new Date()
            console.log(data, publicIdsToDelete)
            const result = await productsCollection.updateOne(query, { $set: data })
            for (let publicId of publicIdsToDelete) {
                await cloudinary.uploader.destroy(publicId)
            }
            res.send(result)
        })
        // status update

        app.patch("/product/:id/status", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const { newStatus } = req.body
            const update = { $set: { status: newStatus } }
            console.log(query, update)
            const result = await productsCollection.updateOne(query, update)
            res.send(result)
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

        app.delete("/product/:id", async (req, res) => {
            try {
                const { id } = req.params
                const query = { _id: new ObjectId(id) }
                const product = await productsCollection.findOne(query)
                if (!product) {
                    res.status(404).send({ message: "No Product Found" })
                }
                for (let image of product.images) {
                    await cloudinary.uploader.destroy(image.publicId)
                }
                const result = await productsCollection.deleteOne(query)
                res.send(result)
            } catch (error) {
                res.status(error.status || 500).send(error.message || "Server Error")
            }
        })

        // special fn 
        const retryDeletionImage = async () => {
            const jobs = await failedImagesDeletion.find().toArray()
            if (jobs.length === 0) {
                console.log("No image to delete")
            }
            for (let job of jobs) {
                try {
                    await cloudinary.uploader.destroy(job.publicId)
                    await failedImagesDeletion.deleteOne({ publicId: job.publicId })
                    console.log(job.publicId + " deleted")
                } catch (error) {
                    const query = { publicId: job.publicId }
                    const update = {
                        $set: {
                            lastAttempt: new Date(),
                            error
                        },
                        $inc: { attempt: 1 }
                    }
                    console.log(query, update, error)
                    await failedImagesDeletion.updateOne(query, update)
                }
            }
        }

        cron.schedule(" * * * * * ", retryDeletionImage)

    } finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});