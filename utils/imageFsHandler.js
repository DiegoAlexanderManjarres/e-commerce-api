const { createWriteStream, unlinkSync } = require('fs')

const { imageMimeTypesValidation } = require('../middlewares/validation/validation')

const mkdirp = require('mkdirp')
const shortid = require('shortid')



const uploadImageDir = './uploads/images'


// File store upload 
const storeUpload = async upload => {   
   const { stream,  mimetype, encoding } = await upload
   const validationResult = imageMimeTypesValidation({ mimetype })

   const id = shortid.generate()
   const path = `${uploadImageDir}/${id}.${mimetype.split('/')[1]}`

   return new Promise((resolve, reject) => (
      stream
         .pipe(createWriteStream(path))
         .on('finish', () => resolve({ id, path }))
         .on('error', reject)
   ))
}


const processUpload = async upload => {
   const { stream, mimetype, encoding } = await upload  

   const { id, path } = await storeUpload({ stream,  mimetype })
   return { id, mimetype, encoding, path }
}


const processUploads = uploads => {
   // Ensure upload directory exists
   mkdirp.sync(uploadImageDir)
   return Promise.all(uploads.map(processUpload))
}


const deleteImages = async images => (
   images.forEach(img => unlinkSync(img.path))
)


module.exports = { processUpload, processUploads, deleteImages }
