const { Schema, model } = require('mongoose')


const productSchema = new Schema({
   name: { type: String, required: true },
   imagesUrls: [{
      url: { type: String, required: true },
      public_id: { type: String, required: true }
   }],
   description: { type: String, required: true },
   price: { type: Number, required: true },
   inStock: { type: Boolean, required: true }
}, { 
   timestamps: true 
})

module.exports = model('Product', productSchema)