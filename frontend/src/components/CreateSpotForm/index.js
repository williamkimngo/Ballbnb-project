import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"
import { actionAddSpot, actionAddImageUrl } from "../../store/spots"
import SpotDetail from "../SpotDetail"
import './createForm.css'

const CreateSpotForm = () => {
   const dispatch = useDispatch()
   const history = useHistory()
   const sessionUser = useSelector(state => state.session.user)
   const [address, setAddress] = useState('')
   const [city, setCity] = useState("");
   const [state, setState] = useState("");
   const [country, setCountry] = useState("");
   const [name, setName] = useState("");
   const [description, setDescription] = useState("");
   const [price, setPrice] = useState(0);
   const [img, setImg] = useState("")
   const [errors, setErrors] = useState([]);
   const [validationErrors, setValidationErrors] = useState([]);

   const handleSubmit = async (e) => {
      console.log("IMAGWEEEE", img)
      e.preventDefault()
      if (validationErrors.length) {
         return
      }
      setErrors([]);
      setValidationErrors([]);
      const payload = {

         address,
         city,
         state,
         country,
         name,
         description,
         price
      }
      const payloadImg = {
         url: img,
         preview: true
      }
      // console.log("PAYLOADSPOT!", payload)
      let createdSpot = await dispatch(actionAddSpot(payload))
         .catch(async (res) => {
            const data = await res.json();
            if (data && data.errors) setErrors(data.errors);

         });
      // console.log("PAYLOAD!!!!", payloadImg)
      // console.log("CREATESDSPOT", createdSpot)
      // console.log("CREATEDSPOTID!!!!", createdSpot.id)

      if (createdSpot) {
         let newImg = await dispatch(actionAddImageUrl(payloadImg, createdSpot.id)).catch(async (res) => {
            const data = await res.json();
            if (data && data.errors) setErrors(data.errors)
         })
      }


      if (createdSpot && !errors.length) {
         history.push('/current');
      }
   }
   return (
      <div className="Create-Spot-Form-container">
         <form className="form-wrap" onSubmit={handleSubmit}>
            <h2>Create a Spot</h2>
            {!sessionUser && <span className="no-user-error">Please login or signup to host your Stadium.</span>}
            <ul className="error-list">
               {errors.map((error, idx) => <li key={idx}>{error}</li>)}
            </ul>
            <label>

               <input
                  placeholder="Address"
                  type='text'
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
               />
            </label>
            <label>

               <input
                  placeholder="City"
                  type='text'
                  value={city}
                  onChange={e => setCity(e.target.value)}

               />
            </label>

            <label>
               <input
                  placeholder="State"
                  type='text'
                  value={state}
                  onChange={e => setState(e.target.value)}

               />
            </label>

            <label>

               <input
                  placeholder="Country"
                  type='text'
                  value={country}
                  onChange={e => setCountry(e.target.value)}

               />
            </label>
            <label>

               <input
                  placeholder="Name"
                  type='text'
                  value={name}
                  onChange={e => setName(e.target.value)}

               />
            </label>

            <label>

               <textarea
                  placeholder="Description"
                  type='text'
                  value={description}
                  onChange={e => setDescription(e.target.value)}

               />
            </label>

            <label>

               <input
                  placeholder="Price"
                  type='number'
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}

               />
            </label>
            <label>
               <input
                  placeholder="Image URL"
                  type='text'
                  value={img}
                  onChange={e => setImg(e.target.value)}
               />
            </label>

            <button type="submit" disabled={sessionUser ? false : true}>Create Spot</button>

         </form>
      </div>
   )
}


export default CreateSpotForm
